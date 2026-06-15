import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import ThemeToggle from "@/components/ui/ThemeToggle";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Sidebar role={role} />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <div />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <TopBar userId={session.user.userId} role={role} />
          </div>
        </header>
        <main className="flex-1 p-6">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
