import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ userId: userId.trim() });

  // Always return success to prevent user enumeration
  if (!user || !user.email) {
    return NextResponse.json({ ok: true });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  user.resetToken = tokenHash;
  user.resetTokenExpiry = expiry;
  await user.save();

  const resetLink = `${process.env.NEXTAUTH_URL}/login/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetLink);

  return NextResponse.json({ ok: true });
}
