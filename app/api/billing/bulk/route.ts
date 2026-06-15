import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import { requireRole, writeLog } from "@/lib/apiHelpers";

async function nextInvoiceNumber(): Promise<string> {
  const last = await Invoice.findOne({}).sort({ createdAt: -1 }).lean();
  if (!last) return "INV-0001";
  const match = last.invoiceNumber.match(/(\d+)$/);
  const num = match ? parseInt(match[1]) + 1 : 1;
  return `INV-${String(num).padStart(4, "0")}`;
}

// POST /api/billing/bulk — generate monthly invoices for all active customers
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator"]);
  if (error) return error;

  const body = await req.json();
  const { year, month } = body; // month is 1-indexed (1-12)

  if (
    typeof year !== "number" || year < 2000 || year > 2100 ||
    typeof month !== "number" || month < 1 || month > 12
  ) {
    return NextResponse.json({ error: "year (2000–2100) and month (1–12) are required." }, { status: 400 });
  }

  await connectDB();

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);
  // Due date: 15th of the following month
  const dueDate    = new Date(year, month, 15);

  const customers = await Customer.find({ isActive: true }).lean();

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const customer of customers) {
    try {
      // Skip customers with no billing rate
      if (!customer.billingRate || customer.billingRate <= 0) {
        skipped++;
        continue;
      }

      // Skip if an invoice already exists for this customer in this month
      const existing = await Invoice.findOne({
        customerRef: customer._id,
        issuedDate: { $gte: monthStart, $lte: monthEnd },
        status: { $ne: "cancelled" },
      }).lean();

      if (existing) {
        skipped++;
        continue;
      }

      const invoiceNumber = await nextInvoiceNumber();
      const monthLabel = monthStart.toLocaleString("en-GB", { month: "long", year: "numeric" });

      await Invoice.create({
        invoiceNumber,
        customerRef: customer._id,
        branchRef: customer.branchRef ?? undefined,
        items: [
          {
            description: `Monthly gas subscription — ${monthLabel}`,
            quantity: 1,
            unitPrice: customer.billingRate,
            total: customer.billingRate,
          },
        ],
        subtotal: customer.billingRate,
        discount: 0,
        total: customer.billingRate,
        status: "issued",
        issuedDate: monthStart,
        dueDate,
        createdBy: session!.user.id,
      });

      await Customer.findByIdAndUpdate(customer._id, {
        $inc: { outstandingBalance: customer.billingRate },
      });

      created++;
    } catch (err) {
      errors.push(`${customer.userId}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const monthLabel = monthStart.toLocaleString("en-GB", { month: "long", year: "numeric" });
  await writeLog(
    "system",
    `Bulk billing run for ${monthLabel}: ${created} invoices created, ${skipped} skipped.`,
    session!.user.id,
    { year, month, created, skipped }
  );

  return NextResponse.json({ ok: true, created, skipped, errors });
}
