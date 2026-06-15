import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/apiHelpers";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { ROLES } from "@/lib/constants";

// GET — list all users (admin only)
export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  await connectDB();
  const users = await User.find().select("userId displayName email role createdAt").sort({ createdAt: -1 });
  return NextResponse.json({ users });
}

// POST — create new user (admin only)
export async function POST(req: NextRequest) {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  const { userId, password, role, email, displayName } = await req.json();
  if (!userId || !password || !role) {
    return NextResponse.json({ error: "userId, password, and role are required." }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  await connectDB();
  const exists = await User.findOne({ userId });
  if (exists) return NextResponse.json({ error: "User ID already taken." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ userId, passwordHash, role, email: email || undefined, displayName: displayName || undefined });
  return NextResponse.json({ user: { _id: user._id, userId: user.userId, role: user.role } }, { status: 201 });
}

// DELETE — remove user (admin only, cannot delete self)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  await connectDB();
  const user = await User.findById(id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user._id.toString() === session!.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  await User.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}

// PUT — update user (admin only): reset password, update email/displayName
export async function PUT(req: NextRequest) {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  const { id, password, email, displayName, role } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  await connectDB();
  const user = await User.findById(id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  if (email !== undefined) user.email = email.trim().toLowerCase() || undefined;
  if (displayName !== undefined) user.displayName = displayName;
  if (role && ROLES.includes(role)) user.role = role;
  await user.save();

  return NextResponse.json({ ok: true });
}
