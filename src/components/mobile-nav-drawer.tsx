"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DealerRole } from "@/server/auth/types";
import { DealershipSwitcher } from "./dealership-switcher";

type DealershipOption = {
  id: string;
  name: string;
  slug: string;
  role: DealerRole;
};

type MobileNavDrawerProps = {
  userEmail: string;
  role: DealerRole | null;
  isSuperAdmin: boolean;
  businessId: string;
  businessName: string;
  availableBusinesses: DealershipOption[];
};

export function MobileNavDrawer({
  userEmail,
  role,
  isSuperAdmin,
  businessId,
  businessName,
  availableBusinesses,
}: MobileNavDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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

  const navLinks = [
    { href: "/app", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { href: "/vehicles", label: "Vehicles", icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2" },
    { href: "/vehicles/new", label: "Add Vehicle", icon: "M12 4v16m8-8H4" },
    { href: "/account", label: "Account Settings", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:outline-hidden md:hidden"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative ml-auto w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center tracking-tighter">
                  V360
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Vehicle 360</div>
                  <div className="text-[10px] text-slate-500 font-medium">Internal App</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Dealership Switcher Block */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Active Dealership
              </div>
              <DealershipSwitcher
                currentBusinessId={businessId}
                currentBusinessName={businessName}
                availableBusinesses={availableBusinesses}
              />
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navLinks.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors min-h-[44px] ${
                      isActive
                        ? "bg-red-50 text-red-600 border border-red-100"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 ${isActive ? "text-red-600" : "text-slate-400"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                );
              })}

              {isSuperAdmin && (
                <Link
                  href="/super-admin/clients"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-red-700 bg-red-50/50 hover:bg-red-50 border border-red-200 mt-3 min-h-[44px] transition-colors"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Super Admin Console
                </Link>
              )}
            </nav>

            {/* Footer / Account */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{userEmail}</div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {role === "DEALER_ADMIN" ? "Dealership Admin" : "Team Member"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
