import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import StockMovement from "@/models/StockMovement";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import { COMPANIES, PACKAGE_SIZES, SALE_TYPES, KG_SIZES } from "@/lib/constants";

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
  const page    = parseInt(searchParams.get("page") ?? "1");
  const limit   = 20;
  const type    = searchParams.get("type") ?? "";
  const company = searchParams.get("company") ?? "";
  const branch  = searchParams.get("branch") ?? "";
  const from    = searchParams.get("from") ?? "";
  const to      = searchParams.get("to") ?? "";

  const filter: Record<string, unknown> = {};
  if (type)    filter.type      = type;
  if (company) filter.company   = company;
  if (branch)  filter.branchRef = branch;
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, unknown>).$gte = new Date(from);
    if (to)   (filter.date as Record<string, unknown>).$lte = new Date(to + "T23:59:59.999Z");
  }

  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("customerRef", "userId fullName")
      .populate("soldBy", "userId role")
      .populate("branchRef", "name code")
      .populate("invoiceRef", "invoiceNumber status total")
      .lean(),
    Sale.countDocuments(filter),
  ]);

  return NextResponse.json({ sales, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const body = await req.json();
  const { type, packageKg, company, quantity, customerRef, branchRef, notes, date, unitPrice = 0, generateInvoice = false } = body;

  if (!SALE_TYPES.includes(type) || !PACKAGE_SIZES.includes(packageKg) || !COMPANIES.includes(company) || typeof quantity !== "number" || quantity < 1) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (typeof unitPrice !== "number" || unitPrice < 0) {
    return NextResponse.json({ error: "unitPrice must be a non-negative number" }, { status: 400 });
  }

  await connectDB();
  const saleDate = date ? new Date(date) : new Date();
  const totalAmount = (unitPrice as number) * quantity;

  const sale = await Sale.create({
    type, packageKg, company, quantity,
    unitPrice,
    totalAmount,
    customerRef: customerRef || undefined,
    branchRef: branchRef || undefined,
    soldBy: session!.user.id,
    notes,
    date: saleDate,
  });

  // Auto stock movement
  if (KG_SIZES.includes(packageKg as typeof KG_SIZES[number])) {
    await StockMovement.create({
      type: "sell",
      kgSize: packageKg,
      company,
      quantity,
      fullDelta: -quantity,
      emptyDelta: 0,
      note: `Auto: Sale #${sale._id} — ${type}`,
      recordedBy: session!.user.id,
      saleRef: sale._id,
      branchRef: branchRef || undefined,
      date: saleDate,
    });
  }

  // Auto-generate invoice when customer is linked and caller requests it
  if (customerRef && generateInvoice && totalAmount > 0) {
    const customer = await Customer.findById(customerRef).lean();
    const invoiceNumber = await nextInvoiceNumber();
    const dueDate = new Date(saleDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await Invoice.create({
      invoiceNumber,
      customerRef,
      branchRef: branchRef || undefined,
      saleRef: sale._id,
      items: [{
        description: `${type} — ${packageKg}kg ${company} x${quantity}`,
        quantity,
        unitPrice,
        total: totalAmount,
      }],
      subtotal: totalAmount,
      discount: 0,
      total: totalAmount,
      dueDate,
      createdBy: session!.user.id,
    });

    await Sale.findByIdAndUpdate(sale._id, { invoiceRef: invoice._id });
    await Customer.findByIdAndUpdate(customerRef, { $inc: { outstandingBalance: totalAmount } });

    await writeLog(
      "daily_count",
      `Sale + Invoice: ${quantity}x ${packageKg}kg ${company} (${type}) — ${customer?.fullName ?? customerRef}`,
      session!.user.id,
      { saleId: sale._id, invoiceId: invoice._id }
    );
  } else {
    await writeLog(
      "daily_count",
      `Sale recorded: ${quantity}x ${packageKg}kg ${company} (${type})`,
      session!.user.id,
      { saleId: sale._id }
    );
  }

  return NextResponse.json(sale, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  const sale = await Sale.findById(id);
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await StockMovement.deleteOne({ saleRef: id });

  if (sale.invoiceRef) {
    const invoice = await Invoice.findById(sale.invoiceRef);
    if (invoice && invoice.status !== "paid") {
      await Invoice.findByIdAndUpdate(sale.invoiceRef, { status: "cancelled" });
      if (sale.customerRef) {
        await Customer.findByIdAndUpdate(sale.customerRef, { $inc: { outstandingBalance: -invoice.total } });
      }
    }
  }

  await Sale.findByIdAndDelete(id);
  await writeLog("system", `Sale deleted: ${id}`, session!.user.id);
  return NextResponse.json({ success: true });
}
