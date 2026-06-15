import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireAuth } from "@/lib/apiHelpers";
import { connectDB } from "@/lib/mongodb";
import AppSetting from "@/models/AppSetting";
import { COMPANIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PACKAGE_SIZES, DEFAULT_BILLING_RATES } from "@/lib/constants";

// Default values (fallback when no DB record exists)
const DEFAULTS = {
  companies: [...COMPANIES],
  paymentMethods: PAYMENT_METHODS.map((key) => ({ key, label: PAYMENT_METHOD_LABELS[key] ?? key })),
  lateFeePerMonth: 0,
  priceList: Object.fromEntries(PACKAGE_SIZES.map((kg) => [kg, DEFAULT_BILLING_RATES[kg] ?? 0])),
};

// GET — fetch app settings (any authenticated user)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const [companiesDoc, pmDoc, lateFeeDoc, priceListDoc] = await Promise.all([
    AppSetting.findOne({ key: "companies" }),
    AppSetting.findOne({ key: "paymentMethods" }),
    AppSetting.findOne({ key: "lateFeePerMonth" }),
    AppSetting.findOne({ key: "priceList" }),
  ]);

  return NextResponse.json({
    companies:       companiesDoc?.value   ?? DEFAULTS.companies,
    paymentMethods:  pmDoc?.value          ?? DEFAULTS.paymentMethods,
    lateFeePerMonth: lateFeeDoc?.value     ?? DEFAULTS.lateFeePerMonth,
    priceList:       priceListDoc?.value   ?? DEFAULTS.priceList,
  });
}

// PUT — update one or more app settings (admin only)
export async function PUT(req: NextRequest) {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json();
  await connectDB();

  const updates: Promise<unknown>[] = [];

  if (body.companies !== undefined) {
    if (!Array.isArray(body.companies) || body.companies.some((c: unknown) => typeof c !== "string")) {
      return NextResponse.json({ error: "companies must be an array of strings." }, { status: 400 });
    }
    updates.push(
      AppSetting.findOneAndUpdate(
        { key: "companies" },
        { value: body.companies },
        { upsert: true, new: true }
      )
    );
  }

  if (body.paymentMethods !== undefined) {
    if (!Array.isArray(body.paymentMethods) ||
        body.paymentMethods.some((m: unknown) => typeof (m as { key?: unknown }).key !== "string" || typeof (m as { label?: unknown }).label !== "string")) {
      return NextResponse.json({ error: "paymentMethods must be an array of {key, label} objects." }, { status: 400 });
    }
    updates.push(
      AppSetting.findOneAndUpdate(
        { key: "paymentMethods" },
        { value: body.paymentMethods },
        { upsert: true, new: true }
      )
    );
  }

  if (body.lateFeePerMonth !== undefined) {
    const rate = Number(body.lateFeePerMonth);
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: "lateFeePerMonth must be a non-negative number." }, { status: 400 });
    }
    updates.push(
      AppSetting.findOneAndUpdate(
        { key: "lateFeePerMonth" },
        { value: rate },
        { upsert: true, new: true }
      )
    );
  }

  if (body.priceList !== undefined) {
    if (typeof body.priceList !== "object" || Array.isArray(body.priceList)) {
      return NextResponse.json({ error: "priceList must be an object mapping package kg to price." }, { status: 400 });
    }
    for (const [kg, price] of Object.entries(body.priceList)) {
      if (!PACKAGE_SIZES.includes(Number(kg) as typeof PACKAGE_SIZES[number])) {
        return NextResponse.json({ error: `Invalid package size: ${kg}` }, { status: 400 });
      }
      if (typeof price !== "number" || (price as number) < 0) {
        return NextResponse.json({ error: `Price for ${kg}kg must be a non-negative number.` }, { status: 400 });
      }
    }
    updates.push(
      AppSetting.findOneAndUpdate(
        { key: "priceList" },
        { value: body.priceList },
        { upsert: true, new: true }
      )
    );
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true });
}
