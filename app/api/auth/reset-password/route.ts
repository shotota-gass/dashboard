import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Token and a password (min 6 chars) are required." }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await connectDB();
  const user = await User.findOne({
    resetToken: tokenHash,
    resetTokenExpiry: { $gt: new Date() },
  });

  if (!user) {
    return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  return NextResponse.json({ ok: true });
}
