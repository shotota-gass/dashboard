import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee from "@/models/Employee";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import { ROLES } from "@/lib/constants";

export async function GET() {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  await connectDB();
  const employees = await Employee.find({}).sort({ createdAt: -1 }).lean();
  const users = await User.find({}, { passwordHash: 0 }).lean();

  return NextResponse.json({ employees, users });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json();
  const { name, contact, nid, address, role, userId, password } = body;

  if (!name || !contact || !nid || !address || !ROLES.includes(role) || !userId || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  await connectDB();

  const existing = await User.findOne({ userId });
  if (existing) return NextResponse.json({ error: "User ID already exists" }, { status: 409 });

  const employee = await Employee.create({ name, contact, nid, address, role });
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ userId, passwordHash, role, employeeRef: employee._id });

  await writeLog("system", `Employee created: ${name} (${userId})`, session!.user.id);

  return NextResponse.json(employee, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json();
  const { id, name, contact, nid, address, role, password } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (password !== undefined && password !== "" && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  await connectDB();
  const employee = await Employee.findByIdAndUpdate(id, { name, contact, nid, address, role }, { new: true });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.findOneAndUpdate({ employeeRef: id }, { passwordHash });
  }

  await writeLog("system", `Employee updated: ${employee.name}`, session!.user.id);

  return NextResponse.json(employee);
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  const emp = await Employee.findByIdAndDelete(id);
  await User.findOneAndDelete({ employeeRef: id });

  await writeLog("system", `Employee deleted: ${emp?.name ?? id}`, session!.user.id);

  return NextResponse.json({ success: true });
}
