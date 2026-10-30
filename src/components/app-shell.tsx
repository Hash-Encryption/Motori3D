import Link from "next/link";
import type { ReactNode } from "react";
import { getAuthContext } from "@/server/auth/auth-context";
import { DealershipSwitcher } from "./dealership-switcher";
import { AccountDropdown } from "./account-dropdown";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { AuthShell } from "./auth-shell";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const context = await getAuthContext().catch(() => null);

  if (!context || !context.business) {
    return <AuthShell>{children}</AuthShell>;
  }

  const { user, business, role, isSuperAdmin, allMemberships } = context;
  const roleLabel = role === "DEALER_ADMIN" ? "Admin" : "Member";

  const availableBusinesses = allMemberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    slug: m.business.slug,
    role: m.role,
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[64px] flex items-center justify-between gap-4">
          {/* Left: Brand + Dealership Switcher */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link href="/app" className="inline-flex items-center gap-2 font-extrabold text-slate-900 tracking-tight text-base shrink-0">
              <span className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs flex items-center justify-center font-black tracking-tighter relative">
                V360
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
              </span>
              <span className="hidden sm:inline">Vehicle 360</span>
            </Link>

            <div className="h-5 w-px bg-slate-200 hidden md:block" aria-hidden="true" />

            {/* Desktop Active Dealership Switcher */}
            <div className="hidden md:flex items-center gap-2">
              <DealershipSwitcher
                currentBusinessId={business.id}
                currentBusinessName={business.name}
                availableBusinesses={availableBusinesses}
              />
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600" aria-label="Main Navigation">
            <Link
              href="/app"
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Overview
            </Link>
            <Link
              href="/vehicles"
              className="px-3 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Vehicles
            </Link>
            <Link
              href="/vehicles/new"
              className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-bold transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Vehicle
            </Link>

            {isSuperAdmin && (
              <Link
                href="/super-admin/clients"
                className="ml-2 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors inline-flex items-center gap-1"
              >
                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Super Admin
              </Link>
            )}
          </nav>

          {/* Right Controls: Desktop Account Dropdown & Mobile Hamburger */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <AccountDropdown
                userEmail={user.email || "user@dealership"}
                role={role}
                isSuperAdmin={isSuperAdmin}
              />
            </div>

            {/* Mobile Drawer Trigger */}
            <MobileNavDrawer
              userEmail={user.email || "user@dealership"}
              role={role}
              isSuperAdmin={isSuperAdmin}
              businessId={business.id}
              businessName={business.name}
              availableBusinesses={availableBusinesses}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[max(32px,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
