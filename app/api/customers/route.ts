import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import { DEFAULT_BILLING_RATES, PACKAGE_SIZES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const q        = searchParams.get("q") ?? "";
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;
  const branch   = searchParams.get("branch") ?? "";
  const active   = searchParams.get("active");

  const filter: Record<string, unknown> = {};
  if (branch) filter.branchRef = branch;
  if (active !== null) filter.isActive = active !== "false";

  if (q) {
    filter.$or = [
      { fullName: { $regex: q, $options: "i" } },
      { userId: { $regex: q, $options: "i" } },
      { contact: { $regex: q, $options: "i" } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("branchRef", "name code")
      .lean(),
    Customer.countDocuments(filter),
  ]);

  return NextResponse.json({ customers, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const body = await req.json();
  const { userId, fullName, nid, contact, comment, address, packageType, lastPackage, billPaidTill, branchRef, billingRate } = body;

  if (!userId || !fullName || !nid || !contact || !address?.area || !address?.road || !address?.houseFlat || !PACKAGE_SIZES.includes(packageType)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await connectDB();

  const rate = typeof billingRate === "number" ? billingRate : (DEFAULT_BILLING_RATES[packageType] ?? 0);

  const customer = await Customer.create({
    userId, fullName, nid, contact, comment, address, packageType,
    lastPackage: lastPackage ? new Date(lastPackage) : undefined,
    billPaidTill: billPaidTill ? new Date(billPaidTill) : undefined,
    branchRef: branchRef || undefined,
    billingRate: rate,
  });

  await writeLog("system", `Customer created: ${fullName} (${userId})`, session!.user.id);
  return NextResponse.json(customer, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  const body = await req.json();
  const { id, ...update } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (update.packageType !== undefined && !PACKAGE_SIZES.includes(update.packageType)) {
    return NextResponse.json({ error: "Invalid package type" }, { status: 400 });
  }
  if (update.fullName !== undefined && !update.fullName?.trim()) {
    return NextResponse.json({ error: "Full name cannot be empty" }, { status: 400 });
  }
  if (update.contact !== undefined && !update.contact?.trim()) {
    return NextResponse.json({ error: "Contact cannot be empty" }, { status: 400 });
  }
  if (update.address?.area !== undefined && !update.address.area?.trim()) {
    return NextResponse.json({ error: "Address area cannot be empty" }, { status: 400 });
  }

  if (update.lastPackage) update.lastPackage = new Date(update.lastPackage);
  if (update.billPaidTill) update.billPaidTill = new Date(update.billPaidTill);
  if (update.branchRef === "") update.branchRef = undefined;

  await connectDB();
  const customer = await Customer.findByIdAndUpdate(id, update, { new: true });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeLog("system", `Customer updated: ${customer.fullName}`, session!.user.id);
  return NextResponse.json(customer);
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  // Soft delete
  const c = await Customer.findByIdAndUpdate(id, { isActive: false }, { new: true });
  await writeLog("system", `Customer deactivated: ${c?.fullName ?? id}`, session!.user.id);
  return NextResponse.json({ success: true });
}
