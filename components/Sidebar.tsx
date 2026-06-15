"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  ClipboardList,
  BarChart2,
  Building2,
  FileText,
  CreditCard,
  LogOut,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",            label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "customer_care_executive", "computer_operator", "driver", "delivery_man"] },
  { href: "/dashboard/branches",   label: "Branches",  icon: Building2,       roles: ["admin"] },
  { href: "/dashboard/stock",      label: "Stock",     icon: Package,         roles: ["admin", "customer_care_executive", "computer_operator"] },
  { href: "/dashboard/sales",      label: "Sales",     icon: ShoppingCart,    roles: ["admin", "customer_care_executive", "computer_operator"] },
  { href: "/dashboard/customers",  label: "Customers", icon: Users,           roles: ["admin", "customer_care_executive", "computer_operator"] },
  { href: "/dashboard/billing",    label: "Billing",   icon: CreditCard,      roles: ["admin", "computer_operator", "customer_care_executive"] },
  { href: "/dashboard/invoices",   label: "Invoices",  icon: FileText,        roles: ["admin", "computer_operator", "customer_care_executive"] },
  { href: "/dashboard/employees",  label: "Employees", icon: UserCog,         roles: ["admin"] },
  { href: "/dashboard/reports",    label: "Reports",   icon: BarChart2,       roles: ["admin", "computer_operator"] },
  { href: "/dashboard/logs",       label: "Logs",      icon: ClipboardList,   roles: ["admin", "computer_operator"] },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => item.roles.includes(role));
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (!["admin", "customer_care_executive", "computer_operator"].includes(role)) return;
    fetch("/api/stock/alerts")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setLowStockCount(d.lowStockCount ?? 0); })
      .catch(() => {});
  }, [role]);

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40 bg-white border-r border-gray-100 shadow-[2px_0_20px_rgba(0,0,0,0.04)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 overflow-hidden">
          <Image src="/logo.svg" alt="Shotota Gas" width={20} height={20} className="brightness-0 invert" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Shotota Gas</p>
          <p className="text-[10px] text-gray-400 leading-tight font-medium tracking-wide">MANAGEMENT PORTAL</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto px-3">
        {visible.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl mb-0.5 transition-all duration-150 ${
                active
                  ? "bg-gray-900 text-white font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium"
              }`}
            >
              <item.icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/dashboard/stock" && lowStockCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {lowStockCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-0.5">
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-150 ${
            pathname.startsWith("/dashboard/settings")
              ? "bg-gray-900 text-white font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium"
          }`}
        >
          <Settings size={16} strokeWidth={pathname.startsWith("/dashboard/settings") ? 2.5 : 2} />
          Settings
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 text-sm text-gray-400 hover:text-gray-900 font-medium transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-gray-50"
        >
          <LogOut size={16} strokeWidth={2} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
