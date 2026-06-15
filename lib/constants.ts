export const COMPANIES = [
  "Uni Gas",
  "Bashundhara LP Gas Ltd",
  "Omera LPG",
  "Jamuna LPG",
  "BM LPG",
  "LAUGFS Gas",
  "Totalgaz",
  "G-Gas",
  "Petromax LPG",
  "Navana LPG",
  "Promita LPG",
  "Universal LPG",
  "Orion LPG",
  "JMI LPG",
  "Index LP Gas",
  "Sena LPG",
] as const;

export const KG_SIZES = [12, 35, 45] as const;
export const PACKAGE_SIZES = [12, 22, 30, 35, 45] as const;

export const ROLES = [
  "admin",
  "customer_care_executive",
  "computer_operator",
  "driver",
  "delivery_man",
] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  customer_care_executive: "Customer Care Executive",
  computer_operator: "Computer Operator",
  driver: "Driver",
  delivery_man: "Delivery Man",
};

export const SALE_TYPES = ["package", "refill", "bottle"] as const;

export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "bank_transfer", "other"] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

export const INVOICE_STATUS = ["draft", "issued", "paid", "overdue", "cancelled"] as const;
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

// Default monthly billing rates per package kg (BDT)
export const DEFAULT_BILLING_RATES: Record<number, number> = {
  12: 1200,
  22: 2200,
  30: 3000,
  35: 3500,
  45: 4500,
};
