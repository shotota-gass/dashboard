"use client";

import { useState, useEffect } from "react";
import { COMPANIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "./constants";

export interface AppPaymentMethod {
  key: string;
  label: string;
}

interface AppSettings {
  companies: string[];
  paymentMethods: AppPaymentMethod[];
  lateFeePerMonth: number;
  loading: boolean;
}

const DEFAULTS: Omit<AppSettings, "loading"> = {
  companies: [...COMPANIES],
  paymentMethods: PAYMENT_METHODS.map((key) => ({ key, label: PAYMENT_METHOD_LABELS[key] ?? key })),
  lateFeePerMonth: 0,
};

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<Omit<AppSettings, "loading">>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/app")
      .then((r) => r.json())
      .then((d) => {
        setSettings({
          companies:       d.companies       ?? DEFAULTS.companies,
          paymentMethods:  d.paymentMethods  ?? DEFAULTS.paymentMethods,
          lateFeePerMonth: d.lateFeePerMonth ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return { ...settings, loading };
}
