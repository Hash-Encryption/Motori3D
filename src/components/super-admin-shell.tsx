"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SuperAdminShellProps = {
  userEmail: string;
  children: React.ReactNode;
};

export function SuperAdminShell({ userEmail, children }: SuperAdminShellProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/auth/sign-in";
    } catch {
      window.location.href = "/auth/sign-in";
    }
  }

  const isClientsActive = pathname === "/super-admin/clients" || pathname.startsWith("/super-admin/clients/");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Super Admin Topbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[64px] flex items-center justify-between gap-4">
          {/* Brand + Platform Indicator */}
          <div className="flex items-center gap-3">
            <Link href="/super-admin/clients" className="inline-flex items-center gap-2.5 font-extrabold text-slate-900 tracking-tight text-base">
              <span className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs flex items-center justify-center font-black tracking-tighter relative">
                V360
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
              </span>
              <span>Vehicle 360</span>
            </Link>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Platform Super Admin
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Super Admin Navigation">
            <Link
              href="/super-admin/clients"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isClientsActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Clients / Dealerships
            </Link>

            <div className="h-4 w-px bg-slate-200 mx-2" aria-hidden="true" />

            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dealership App
            </Link>
          </nav>

          {/* User Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-700 max-w-[140px] truncate">
                {userEmail}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {signingOut ? "Signing Out..." : "Sign Out"}
            </button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top duration-150">
            <Link
              href="/super-admin/clients"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-900 bg-slate-100"
            >
              Clients / Dealerships
            </Link>
            <Link
              href="/app"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              ← Back to Dealership App
            </Link>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 truncate max-w-[180px]">{userEmail}</span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="text-xs font-bold text-red-600"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[max(32px,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
