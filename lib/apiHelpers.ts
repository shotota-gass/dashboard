import { auth } from "./auth";
import { connectDB } from "./mongodb";
import Log from "@/models/Log";
import { NextResponse } from "next/server";

export async function getSession() {
  return auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireRole(allowedRoles: string[]) {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };
  if (!allowedRoles.includes(session!.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export async function writeLog(
  type: "daily_count" | "system",
  action: string,
  userId: string,
  metadata?: Record<string, unknown>
) {
  try {
    await connectDB();
    await Log.create({ type, action, performedBy: userId, metadata, date: new Date() });
  } catch {
    // Non-critical: don't fail request if log write fails
  }
}
