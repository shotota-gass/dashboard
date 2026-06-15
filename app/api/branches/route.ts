import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import { requireRole, writeLog } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") !== "false";

  const filter: Record<string, unknown> = {};
  if (activeOnly) filter.isActive = true;

  const branches = await Branch.find(filter)
    .populate("managerRef", "userId role")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ branches });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json();
  const { name, code, address, contact, managerRef } = body;

  if (!name?.trim() || !code?.trim() || !address?.trim() || !contact?.trim()) {
    return NextResponse.json({ error: "name, code, address and contact are required" }, { status: 400 });
  }

  await connectDB();

  const exists = await Branch.findOne({ code: code.toUpperCase().trim() });
  if (exists) return NextResponse.json({ error: "Branch code already exists" }, { status: 409 });

  const branch = await Branch.create({
    name: name.trim(),
    code: code.toUpperCase().trim(),
    address: address.trim(),
    contact: contact.trim(),
    managerRef: managerRef || undefined,
  });

  await writeLog("system", `Branch created: ${branch.name} (${branch.code})`, session!.user.id);
  return NextResponse.json(branch, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  const { name, address, contact, managerRef, isActive } = body;

  if (name !== undefined && !name?.trim()) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  if (address !== undefined && !address?.trim()) return NextResponse.json({ error: "Address cannot be empty" }, { status: 400 });
  if (contact !== undefined && !contact?.trim()) return NextResponse.json({ error: "Contact cannot be empty" }, { status: 400 });
  if (isActive !== undefined && typeof isActive !== "boolean") return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (address !== undefined) updates.address = address.trim();
  if (contact !== undefined) updates.contact = contact.trim();
  if (managerRef !== undefined) updates.managerRef = managerRef || undefined;
  if (isActive !== undefined) updates.isActive = isActive;

  await connectDB();
  const branch = await Branch.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  await writeLog("system", `Branch updated: ${branch.name}`, session!.user.id);
  return NextResponse.json(branch);
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  const branch = await Branch.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  await writeLog("system", `Branch deactivated: ${branch.name}`, session!.user.id);
  return NextResponse.json({ success: true });
}
