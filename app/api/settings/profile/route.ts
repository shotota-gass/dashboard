import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiHelpers";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  await connectDB();
  const user = await User.findOne({ userId: session!.user.userId }).select("userId displayName email role");
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ user });
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { displayName, email } = await req.json();

  await connectDB();
  const user = await User.findOne({ userId: session!.user.userId });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (displayName !== undefined) user.displayName = displayName;
  if (email !== undefined) user.email = email.trim().toLowerCase() || undefined;
  await user.save();

  return NextResponse.json({ ok: true });
}
