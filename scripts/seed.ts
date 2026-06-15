// @ts-nocheck
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/shotota-gas";

// ─── Inline schemas (avoid Next.js module resolution issues) ─────────────────

const UserSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, required: true },
  displayName:  String,
  email:        String,
  employeeRef:  { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
});

const EmployeeSchema = new mongoose.Schema({
  name:    String,
  contact: String,
  nid:     String,
  address: String,
  role:    String,
}, { timestamps: true });

const BranchSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  code:       { type: String, required: true, unique: true, uppercase: true },
  address:    { type: String, required: true },
  contact:    { type: String, required: true },
  managerRef: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

const CustomerSchema = new mongoose.Schema({
  userId:             { type: String, required: true, unique: true },
  fullName:           { type: String, required: true },
  nid:                { type: String, required: true },
  contact:            { type: String, required: true },
  comment:            String,
  address: {
    area:      { type: String, required: true },
    road:      { type: String, required: true },
    houseFlat: { type: String, required: true },
  },
  packageType:        { type: Number, required: true },
  lastPackage:        Date,
  billPaidTill:       Date,
  branchRef:          { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  billingRate:        { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 },
  isActive:           { type: Boolean, default: true },
}, { timestamps: true });

const InvoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity:    { type: Number, required: true },
  unitPrice:   { type: Number, required: true },
  total:       { type: Number, required: true },
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  customerRef:   { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  branchRef:     { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  saleRef:       { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
  items:         { type: [InvoiceItemSchema], required: true },
  subtotal:      { type: Number, required: true },
  discount:      { type: Number, default: 0 },
  total:         { type: Number, required: true },
  status:        { type: String, default: "issued" },
  issuedDate:    { type: Date, default: Date.now },
  dueDate:       { type: Date, required: true },
  paidDate:      Date,
  notes:         String,
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const PaymentSchema = new mongoose.Schema({
  customerRef:   { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  invoiceRef:    { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
  branchRef:     { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  amount:        { type: Number, required: true },
  method:        { type: String, required: true },
  transactionId: String,
  receivedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date:          { type: Date, default: Date.now },
  note:          String,
}, { timestamps: true });

const SaleSchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  type:        { type: String, required: true },
  packageKg:   { type: Number, required: true },
  company:     { type: String, required: true },
  quantity:    { type: Number, required: true },
  unitPrice:   { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  customerRef: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  branchRef:   { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  invoiceRef:  { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
  soldBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  notes:       String,
}, { timestamps: true });

const StockEntrySchema = new mongoose.Schema({
  date:       { type: Date, default: Date.now },
  kgSize:     { type: Number, required: true },
  company:    { type: String, required: true },
  status:     { type: String, required: true },
  quantity:   { type: Number, required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  note:       String,
}, { timestamps: true });

const StockMovementSchema = new mongoose.Schema({
  type:             { type: String, required: true },
  kgSize:           { type: Number, required: true },
  company:          { type: String, required: true },
  quantity:         { type: Number, required: true },
  fullDelta:        { type: Number, required: true },
  emptyDelta:       { type: Number, required: true },
  note:             String,
  date:             { type: Date, default: Date.now },
  recordedBy:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  saleRef:          { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
  branchRef:        { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  transferToBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
}, { timestamps: true });

const AppSettingSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const LogSchema = new mongoose.Schema({
  type:        { type: String, required: true },
  action:      { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  metadata:    mongoose.Schema.Types.Mixed,
  date:        { type: Date, default: Date.now },
}, { timestamps: true });

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANIES = [
  "Uni Gas", "Bashundhara LP Gas Ltd", "Omera LPG", "Jamuna LPG",
  "BM LPG", "LAUGFS Gas", "Totalgaz", "G-Gas",
];

const PACKAGE_SIZES = [12, 22, 30, 35, 45] as const;
const KG_SIZES      = [12, 35, 45] as const;

const PRICE_LIST: Record<number, number> = {
  12: 1200, 22: 2200, 30: 3000, 35: 3500, 45: 4500,
};

const PAYMENT_METHODS = ["cash", "bkash", "nagad", "bank_transfer"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let invoiceCounter = 0;
function nextInvNum() {
  invoiceCounter++;
  return `INV-${String(invoiceCounter).padStart(4, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const User         = mongoose.models.User         ?? mongoose.model("User",         UserSchema);
  const Employee     = mongoose.models.Employee     ?? mongoose.model("Employee",     EmployeeSchema);
  const Branch       = mongoose.models.Branch       ?? mongoose.model("Branch",       BranchSchema);
  const Customer     = mongoose.models.Customer     ?? mongoose.model("Customer",     CustomerSchema);
  const Invoice      = mongoose.models.Invoice      ?? mongoose.model("Invoice",      InvoiceSchema);
  const Payment      = mongoose.models.Payment      ?? mongoose.model("Payment",      PaymentSchema);
  const Sale         = mongoose.models.Sale         ?? mongoose.model("Sale",         SaleSchema);
  const StockEntry   = mongoose.models.StockEntry   ?? mongoose.model("StockEntry",   StockEntrySchema);
  const StockMovement = mongoose.models.StockMovement ?? mongoose.model("StockMovement", StockMovementSchema);
  const AppSetting   = mongoose.models.AppSetting   ?? mongoose.model("AppSetting",   AppSettingSchema);
  const Log          = mongoose.models.Log          ?? mongoose.model("Log",          LogSchema);

  const reset = process.argv.includes("--reset");

  // Guard: abort if data already exists (unless --reset)
  const existingUser = await User.findOne({ userId: "SG@AD45" });
  if (existingUser) {
    if (!reset) {
      console.log("Seed data already exists. Run with --reset to drop all data and re-seed.");
      await mongoose.disconnect();
      return;
    }
    console.log("--reset flag detected. Dropping all collections...");
    await Promise.all([
      User.deleteMany({}),
      Employee.deleteMany({}),
      Branch.deleteMany({}),
      Customer.deleteMany({}),
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      Sale.deleteMany({}),
      StockEntry.deleteMany({}),
      StockMovement.deleteMany({}),
      AppSetting.deleteMany({}),
      Log.deleteMany({}),
    ]);
    console.log("Collections cleared.");
  }

  console.log("Seeding...");

  // ── App Settings ────────────────────────────────────────────────────────────
  await AppSetting.insertMany([
    { key: "companies",      value: COMPANIES },
    { key: "paymentMethods", value: [
      { key: "cash",          label: "Cash" },
      { key: "bkash",         label: "bKash" },
      { key: "nagad",         label: "Nagad" },
      { key: "bank_transfer", label: "Bank Transfer" },
    ]},
    { key: "lateFeePerMonth", value: 150 },
    { key: "priceList",       value: PRICE_LIST },
  ]);
  console.log("✓ App settings");

  // ── Employees ───────────────────────────────────────────────────────────────
  const employeeData = [
    { name: "Md. Rafiqul Islam",   contact: "01711000001", nid: "1000000001", address: "Mirpur, Dhaka",         role: "admin" },
    { name: "Sumaiya Akter",       contact: "01711000002", nid: "1000000002", address: "Dhanmondi, Dhaka",      role: "customer_care_executive" },
    { name: "Arif Hossain",        contact: "01711000003", nid: "1000000003", address: "Mohammadpur, Dhaka",    role: "computer_operator" },
    { name: "Jahangir Alam",       contact: "01711000004", nid: "1000000004", address: "Uttara, Dhaka",         role: "customer_care_executive" },
    { name: "Nasrin Sultana",      contact: "01711000005", nid: "1000000005", address: "Gulshan, Dhaka",        role: "computer_operator" },
    { name: "Karim Uddin",         contact: "01711000006", nid: "1000000006", address: "Motijheel, Dhaka",      role: "driver" },
    { name: "Shahidul Haque",      contact: "01711000007", nid: "1000000007", address: "Lalbagh, Dhaka",        role: "delivery_man" },
    { name: "Rokeya Begum",        contact: "01711000008", nid: "1000000008", address: "Demra, Dhaka",          role: "delivery_man" },
  ];
  const employees = await Employee.insertMany(employeeData);
  console.log(`✓ ${employees.length} employees`);

  // ── Users ───────────────────────────────────────────────────────────────────
  const userCredentials = [
    { userId: "SG@AD45",  password: "admin123",    role: "admin",                    name: "Rafiqul Islam",  email: "admin@shotota.gas",    empIdx: 0 },
    { userId: "SG@CC01",  password: "password123", role: "customer_care_executive",  name: "Sumaiya Akter",  email: "sumaiya@shotota.gas",  empIdx: 1 },
    { userId: "SG@CO02",  password: "password123", role: "computer_operator",        name: "Arif Hossain",   email: "arif@shotota.gas",     empIdx: 2 },
    { userId: "SG@CC03",  password: "password123", role: "customer_care_executive",  name: "Jahangir Alam",  email: "jahangir@shotota.gas", empIdx: 3 },
    { userId: "SG@CO04",  password: "password123", role: "computer_operator",        name: "Nasrin Sultana", email: "nasrin@shotota.gas",   empIdx: 4 },
    { userId: "SG@DR05",  password: "password123", role: "driver",                   name: "Karim Uddin",    email: "",                     empIdx: 5 },
    { userId: "SG@DL06",  password: "password123", role: "delivery_man",             name: "Shahidul Haque", email: "",                     empIdx: 6 },
    { userId: "SG@DL07",  password: "password123", role: "delivery_man",             name: "Rokeya Begum",   email: "",                     empIdx: 7 },
  ];
  const users: mongoose.Document[] = [];
  for (const u of userCredentials) {
    const hash = await bcrypt.hash(u.password, 12);
    const created = await User.create({
      userId:      u.userId,
      passwordHash: hash,
      role:        u.role,
      displayName: u.name,
      email:       u.email || undefined,
      employeeRef: employees[u.empIdx]._id,
    });
    users.push(created);
  }
  const adminUser = users[0];
  console.log(`✓ ${users.length} users`);

  // ── Branches ─────────────────────────────────────────────────────────────────
  const branchData = [
    { name: "Mirpur Branch",      code: "MRP-01", address: "Mirpur-10, Dhaka",         contact: "02-9000001", managerRef: adminUser._id },
    { name: "Dhanmondi Branch",   code: "DHN-02", address: "Dhanmondi Road 2, Dhaka",  contact: "02-9000002", managerRef: users[1]._id },
    { name: "Uttara Branch",      code: "UTT-03", address: "Uttara Sector 4, Dhaka",   contact: "02-9000003", managerRef: users[3]._id },
  ];
  const branches = await Branch.insertMany(branchData);
  console.log(`✓ ${branches.length} branches`);

  // ── Customers ────────────────────────────────────────────────────────────────
  const areas   = ["Mirpur", "Dhanmondi", "Uttara", "Mohammadpur", "Gulshan", "Banani", "Motijheel", "Lalbagh"];
  const firstNames = ["Md. Kamal", "Farida", "Nasir", "Rubina", "Anowar", "Shirin", "Habibur", "Momena", "Delwar", "Taslima",
                      "Rafat", "Lovely", "Zahir", "Shahnaz", "Bashir", "Roksana", "Jamal", "Nipa", "Selim", "Kamrun"];
  const lastNames  = ["Hossain", "Begum", "Uddin", "Khatun", "Rahman", "Akter", "Islam", "Parvin", "Miah", "Nessa"];

  const customersToCreate = [];
  for (let i = 1; i <= 30; i++) {
    const pkg   = pick(PACKAGE_SIZES);
    const rate  = PRICE_LIST[pkg];
    const paidMonthsAgo = randInt(0, 4);
    const billPaidTill  = paidMonthsAgo === 0 ? undefined : monthsAgo(paidMonthsAgo);
    // outstanding = unpaid months × rate (rough)
    const outstanding = paidMonthsAgo === 0 ? 0 : paidMonthsAgo * rate - randInt(0, rate);
    customersToCreate.push({
      userId:             `SG-C${String(i).padStart(3, "0")}`,
      fullName:           `${pick(firstNames)} ${pick(lastNames)}`,
      nid:                `20000000${String(i).padStart(2, "0")}`,
      contact:            `017${String(20000000 + i)}`,
      address:            { area: pick(areas), road: `Road ${randInt(1, 20)}`, houseFlat: `House ${randInt(1, 50)}` },
      packageType:        pkg,
      billingRate:        rate,
      billPaidTill:       billPaidTill,
      outstandingBalance: Math.max(0, outstanding),
      isActive:           true,
      branchRef:          pick(branches)._id,
      lastPackage:        daysAgo(randInt(30, 120)),
    });
  }
  // A few inactive customers
  for (let i = 31; i <= 35; i++) {
    const pkg = pick(PACKAGE_SIZES);
    customersToCreate.push({
      userId:             `SG-C${String(i).padStart(3, "0")}`,
      fullName:           `${pick(firstNames)} ${pick(lastNames)}`,
      nid:                `20000000${String(i).padStart(2, "0")}`,
      contact:            `017${String(20000000 + i)}`,
      address:            { area: pick(areas), road: `Road ${randInt(1, 20)}`, houseFlat: `House ${randInt(1, 50)}` },
      packageType:        pkg,
      billingRate:        PRICE_LIST[pkg],
      outstandingBalance: 0,
      isActive:           false,
      branchRef:          pick(branches)._id,
    });
  }
  const customers = await Customer.insertMany(customersToCreate);
  console.log(`✓ ${customers.length} customers`);

  // ── Stock Entries ────────────────────────────────────────────────────────────
  const stockEntries = [];
  for (const kg of KG_SIZES) {
    for (const company of COMPANIES.slice(0, 5)) {
      stockEntries.push({
        date:       daysAgo(1),
        kgSize:     kg,
        company,
        status:     "full",
        quantity:   randInt(5, 40),
        recordedBy: adminUser._id,
        note:       "Initial stock",
      });
      stockEntries.push({
        date:       daysAgo(1),
        kgSize:     kg,
        company,
        status:     "empty",
        quantity:   randInt(2, 15),
        recordedBy: adminUser._id,
      });
    }
  }
  // A couple of low-stock entries for the alert badge to show
  stockEntries.push(
    { date: daysAgo(1), kgSize: 12, company: "Totalgaz", status: "full", quantity: 2, recordedBy: adminUser._id, note: "Low stock" },
    { date: daysAgo(1), kgSize: 35, company: "G-Gas",    status: "full", quantity: 3, recordedBy: adminUser._id, note: "Low stock" },
    { date: daysAgo(1), kgSize: 45, company: "LAUGFS Gas", status: "full", quantity: 1, recordedBy: adminUser._id, note: "Low stock" },
  );
  await StockEntry.insertMany(stockEntries);
  console.log(`✓ ${stockEntries.length} stock entries`);

  // ── Stock Movements ──────────────────────────────────────────────────────────
  const movementTypes: Array<{ type: string; fullDelta: number; emptyDelta: number }> = [
    { type: "receive_full",     fullDelta:  1, emptyDelta:  0 },
    { type: "sell",             fullDelta: -1, emptyDelta:  1 },
    { type: "send_refill",      fullDelta:  0, emptyDelta: -1 },
    { type: "receive_refilled", fullDelta:  1, emptyDelta:  0 },
    { type: "return_empty",     fullDelta:  0, emptyDelta:  1 },
  ];
  const movements = [];
  for (let i = 0; i < 40; i++) {
    const m   = pick(movementTypes);
    const kg  = pick(KG_SIZES);
    const qty = randInt(1, 10);
    movements.push({
      type:       m.type,
      kgSize:     kg,
      company:    pick(COMPANIES.slice(0, 5)),
      quantity:   qty,
      fullDelta:  m.fullDelta  * qty,
      emptyDelta: m.emptyDelta * qty,
      date:       daysAgo(randInt(0, 60)),
      recordedBy: pick(users.slice(0, 3))._id,
      branchRef:  pick(branches)._id,
    });
  }
  await StockMovement.insertMany(movements);
  console.log(`✓ ${movements.length} stock movements`);

  // ── Invoices + Payments ──────────────────────────────────────────────────────
  const activeCustomers = customers.filter(c => (c as {isActive: boolean}).isActive);
  const invoices = [];
  const payments = [];

  for (const customer of activeCustomers.slice(0, 20)) {
    const c = customer as {
      _id: mongoose.Types.ObjectId;
      billingRate: number;
      branchRef: mongoose.Types.ObjectId;
    };

    // Generate 2–4 monthly invoices going back
    const numInvoices = randInt(2, 4);
    for (let m = numInvoices; m >= 1; m--) {
      const issueDate = monthsAgo(m);
      const dueDate   = new Date(issueDate);
      dueDate.setDate(15);
      dueDate.setMonth(dueDate.getMonth() + 1);

      const amount = c.billingRate;
      const isPaid = m > 1; // older invoices are paid; most recent may not be
      const invNum = nextInvNum();

      const inv = {
        invoiceNumber: invNum,
        customerRef:   c._id,
        branchRef:     c.branchRef,
        items: [{
          description: `Monthly gas subscription — ${issueDate.toLocaleString("en-GB", { month: "long", year: "numeric" })}`,
          quantity:    1,
          unitPrice:   amount,
          total:       amount,
        }],
        subtotal:   amount,
        discount:   0,
        total:      amount,
        status:     isPaid ? "paid" : (dueDate < new Date() ? "overdue" : "issued"),
        issuedDate: issueDate,
        dueDate,
        paidDate:   isPaid ? daysAgo(randInt(0, 20) + m * 28) : undefined,
        createdBy:  adminUser._id,
      };
      invoices.push(inv);

      if (isPaid) {
        payments.push({
          customerRef: c._id,
          amount,
          method:      pick(PAYMENT_METHODS),
          receivedBy:  pick(users.slice(0, 3))._id,
          date:        inv.paidDate,
          note:        `Payment for ${invNum}`,
        });
      }
    }
  }

  const insertedInvoices = await Invoice.insertMany(invoices);
  await Payment.insertMany(payments);
  console.log(`✓ ${insertedInvoices.length} invoices, ${payments.length} payments`);

  // ── Sales ────────────────────────────────────────────────────────────────────
  const saleTypes = ["package", "refill", "bottle"] as const;
  const sales = [];
  for (let i = 0; i < 60; i++) {
    const pkg      = pick(PACKAGE_SIZES);
    const saleType = pick(saleTypes);
    const qty      = randInt(1, 5);
    const price    = PRICE_LIST[pkg];
    const customer = randInt(0, 1) ? pick(activeCustomers.slice(0, 20)) as {_id: mongoose.Types.ObjectId; branchRef: mongoose.Types.ObjectId} : null;
    sales.push({
      date:        daysAgo(randInt(0, 90)),
      type:        saleType,
      packageKg:   pkg,
      company:     pick(COMPANIES.slice(0, 5)),
      quantity:    qty,
      unitPrice:   price,
      totalAmount: price * qty,
      customerRef: customer?._id,
      branchRef:   customer?.branchRef ?? pick(branches)._id,
      soldBy:      pick(users.slice(0, 3))._id,
    });
  }
  await Sale.insertMany(sales);
  console.log(`✓ ${sales.length} sales`);

  // ── Logs ─────────────────────────────────────────────────────────────────────
  await Log.insertMany([
    { type: "system", action: "Seed data loaded",               performedBy: adminUser._id, date: new Date() },
    { type: "system", action: "Admin user SG@AD45 created",     performedBy: adminUser._id, date: new Date() },
    { type: "system", action: "Initial stock entries recorded",  performedBy: adminUser._id, date: daysAgo(1) },
  ]);
  console.log("✓ Logs");

  console.log("\n─────────────────────────────────────────");
  console.log("Seed complete. Login credentials:");
  console.log("");
  console.log("  Admin:            SG@AD45   / admin123");
  console.log("  Customer Care:    SG@CC01   / password123");
  console.log("  Computer Operator:SG@CO02   / password123");
  console.log("  Driver:           SG@DR05   / password123");
  console.log("  Delivery:         SG@DL06   / password123");
  console.log("");
  console.log("  → Change passwords after first login!");
  console.log("─────────────────────────────────────────");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
