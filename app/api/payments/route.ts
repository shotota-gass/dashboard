import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import { PAYMENT_METHODS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;
  const customer = searchParams.get("customer") ?? "";
  const invoice  = searchParams.get("invoice") ?? "";
  const branch   = searchParams.get("branch") ?? "";
  const method   = searchParams.get("method") ?? "";
  const from     = searchParams.get("from") ?? "";
  const to       = searchParams.get("to") ?? "";

  const filter: Record<string, unknown> = {};
  if (customer) filter.customerRef = customer;
  if (invoice)  filter.invoiceRef  = invoice;
  if (branch)   filter.branchRef   = branch;
  if (method)   filter.method      = method;
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, unknown>).$gte = new Date(from);
    if (to)   (filter.date as Record<string, unknown>).$lte = new Date(to + "T23:59:59.999Z");
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("customerRef", "userId fullName")
      .populate("invoiceRef", "invoiceNumber total status")
      .populate("branchRef", "name code")
      .populate("receivedBy", "userId role")
      .lean(),
    Payment.countDocuments(filter),
  ]);

  const totalAmount = await Payment.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return NextResponse.json({
    payments,
    total,
    page,
    pages: Math.ceil(total / limit),
    totalAmount: totalAmount[0]?.total ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const body = await req.json();
  const { customerRef, invoiceRef, branchRef, amount, method, transactionId, note, date } = body;

  if (!customerRef || !amount || !method) {
    return NextResponse.json({ error: "customerRef, amount and method are required" }, { status: 400 });
  }
  if (!PAYMENT_METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }
  if (method !== "cash" && !transactionId?.trim()) {
    return NextResponse.json({ error: "transactionId is required for non-cash payments" }, { status: 400 });
  }

  await connectDB();

  const payment = await Payment.create({
    customerRef,
    invoiceRef: invoiceRef || undefined,
    branchRef: branchRef || undefined,
    amount,
    method,
    transactionId: transactionId || undefined,
    receivedBy: session!.user.id,
    date: date ? new Date(date) : new Date(),
    note,
  });

  // If linked to invoice, check if invoice is now fully paid
  if (invoiceRef) {
    const invoice = await Invoice.findById(invoiceRef);
    if (invoice && invoice.status !== "paid") {
      const allPayments = await Payment.find({ invoiceRef }).lean();
      const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
      if (totalPaid >= invoice.total) {
        await Invoice.findByIdAndUpdate(invoiceRef, { status: "paid", paidDate: new Date() });
        await Customer.findByIdAndUpdate(customerRef, { $inc: { outstandingBalance: -invoice.total } });
      }
    }
  } else {
    // Standalone payment — reduce outstanding balance directly
    await Customer.findByIdAndUpdate(customerRef, { $inc: { outstandingBalance: -amount } });
  }

  await writeLog(
    "system",
    `Payment received: ৳${amount} via ${method} from customer ${customerRef}`,
    session!.user.id,
    { paymentId: payment._id }
  );

  return NextResponse.json(payment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  const payment = await Payment.findByIdAndDelete(id);
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  // Reverse the balance adjustment
  await Customer.findByIdAndUpdate(payment.customerRef, { $inc: { outstandingBalance: payment.amount } });

  // If invoice was auto-marked paid, revert
  if (payment.invoiceRef) {
    const invoice = await Invoice.findById(payment.invoiceRef);
    if (invoice?.status === "paid") {
      await Invoice.findByIdAndUpdate(payment.invoiceRef, { status: "issued", paidDate: undefined });
    }
  }

  await writeLog("system", `Payment deleted: ৳${payment.amount}`, session!.user.id);
  return NextResponse.json({ success: true });
}
