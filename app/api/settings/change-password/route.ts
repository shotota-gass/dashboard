import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/apiHelpers";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "Current password and a new password (min 6 chars) are required." }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ userId: session!.user.userId });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  return NextResponse.json({ ok: true });
}
