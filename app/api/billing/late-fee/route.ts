import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import { requireRole, writeLog } from "@/lib/apiHelpers";

// POST — apply a late fee to a customer's outstanding balance
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const { customerId, amount, note } = await req.json();
  if (!customerId || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "customerId and a positive amount are required." }, { status: 400 });
  }

  await connectDB();
  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $inc: { outstandingBalance: amount } },
    { new: true }
  );
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  await writeLog(
    "system",
    `Late fee applied: ${amount} BDT to ${customer.fullName} (${customer.userId}). ${note ?? ""}`.trim(),
    session!.user.id
  );

  return NextResponse.json({ ok: true, outstandingBalance: customer.outstandingBalance });
}
