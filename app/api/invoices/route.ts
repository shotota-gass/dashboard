import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import Payment from "@/models/Payment";
import { requireRole, writeLog } from "@/lib/apiHelpers";

// Auto-increment invoice number helper
async function nextInvoiceNumber(): Promise<string> {
  const last = await Invoice.findOne({}).sort({ createdAt: -1 }).lean();
  if (!last) return "INV-0001";
  const match = last.invoiceNumber.match(/(\d+)$/);
  const num = match ? parseInt(match[1]) + 1 : 1;
  return `INV-${String(num).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;
  const status   = searchParams.get("status") ?? "";
  const customer = searchParams.get("customer") ?? "";
  const branch   = searchParams.get("branch") ?? "";
  const from     = searchParams.get("from") ?? "";
  const to       = searchParams.get("to") ?? "";

  const filter: Record<string, unknown> = {};
  if (status)   filter.status      = status;
  if (customer) filter.customerRef = customer;
  if (branch)   filter.branchRef   = branch;
  if (from || to) {
    filter.issuedDate = {};
    if (from) (filter.issuedDate as Record<string, unknown>).$gte = new Date(from);
    if (to)   (filter.issuedDate as Record<string, unknown>).$lte = new Date(to + "T23:59:59.999Z");
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ issuedDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("customerRef", "userId fullName contact")
      .populate("branchRef", "name code")
      .populate("createdBy", "userId role")
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  // Summary totals for filtered set
  const allFiltered = await Invoice.find(filter).select("total status").lean();
  const summary = {
    totalIssued: allFiltered.filter(i => i.status === "issued").reduce((s, i) => s + i.total, 0),
    totalPaid:   allFiltered.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    totalOverdue: allFiltered.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0),
    count: total,
  };

  return NextResponse.json({ invoices, total, page, pages: Math.ceil(total / limit), summary });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const body = await req.json();
  const { customerRef, branchRef, saleRef, items, discount = 0, dueDate, notes } = body;

  if (!customerRef || !items?.length || !dueDate) {
    return NextResponse.json({ error: "customerRef, items, and dueDate are required" }, { status: 400 });
  }
  if (typeof discount !== "number" || discount < 0) {
    return NextResponse.json({ error: "Discount must be a non-negative number" }, { status: 400 });
  }
  for (const item of items) {
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      return NextResponse.json({ error: "Each item must have quantity >= 1" }, { status: 400 });
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      return NextResponse.json({ error: "Each item must have a non-negative unitPrice" }, { status: 400 });
    }
    if (!item.description?.trim()) {
      return NextResponse.json({ error: "Each item must have a description" }, { status: 400 });
    }
  }

  await connectDB();

  const subtotal = items.reduce((s: number, i: { quantity: number; unitPrice: number }) => s + i.quantity * i.unitPrice, 0);
  const itemsWithTotal = items.map((i: { description: string; quantity: number; unitPrice: number }) => ({
    ...i,
    total: i.quantity * i.unitPrice,
  }));
  const total = Math.max(0, subtotal - discount);

  const invoiceNumber = await nextInvoiceNumber();

  const invoice = await Invoice.create({
    invoiceNumber,
    customerRef,
    branchRef: branchRef || undefined,
    saleRef: saleRef || undefined,
    items: itemsWithTotal,
    subtotal,
    discount,
    total,
    dueDate: new Date(dueDate),
    notes,
    createdBy: session!.user.id,
  });

  // Update customer outstanding balance
  await Customer.findByIdAndUpdate(customerRef, { $inc: { outstandingBalance: total } });

  await writeLog("system", `Invoice created: ${invoiceNumber} — ৳${total}`, session!.user.id, { invoiceId: invoice._id });
  return NextResponse.json(invoice, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  const { status, notes, dueDate } = body;

  const INVOICE_STATUS = ["draft", "issued", "paid", "overdue", "cancelled"];
  if (status !== undefined && !INVOICE_STATUS.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await connectDB();
  const invoice = await Invoice.findById(id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "cancelled") {
    return NextResponse.json({ error: "Cannot update a cancelled invoice" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (dueDate) updates.dueDate = new Date(dueDate);
  if (status === "paid") updates.paidDate = new Date();

  // If marking as paid, reduce customer outstanding balance
  if (status === "paid" && invoice.status !== "paid") {
    await Customer.findByIdAndUpdate(invoice.customerRef, { $inc: { outstandingBalance: -invoice.total } });
  }

  const updated = await Invoice.findByIdAndUpdate(id, { $set: updates }, { new: true });
  await writeLog("system", `Invoice ${invoice.invoiceNumber} marked ${status}`, session!.user.id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  const invoice = await Invoice.findById(id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status !== "cancelled") {
    await Invoice.findByIdAndUpdate(id, { status: "cancelled" });
    // Reverse outstanding balance if it wasn't paid
    if (invoice.status !== "paid") {
      await Customer.findByIdAndUpdate(invoice.customerRef, { $inc: { outstandingBalance: -invoice.total } });
    }
  }

  await writeLog("system", `Invoice ${invoice.invoiceNumber} cancelled`, session!.user.id);
  return NextResponse.json({ success: true });
}

// GET /api/invoices/payments — list payments for an invoice
export async function HEAD(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoiceId");
  if (!invoiceId) return new NextResponse(null, { status: 400 });

  await connectDB();
  const payments = await Payment.find({ invoiceRef: invoiceId })
    .populate("receivedBy", "userId role")
    .sort({ date: -1 })
    .lean();

  return NextResponse.json({ payments });
}
