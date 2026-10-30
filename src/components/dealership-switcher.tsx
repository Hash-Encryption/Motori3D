"use client";

import { useEffect, useRef, useState } from "react";
import type { DealerRole } from "@/server/auth/types";

type DealershipOption = {
  id: string;
  name: string;
  slug: string;
  role: DealerRole;
};

type DealershipSwitcherProps = {
  currentBusinessId: string;
  currentBusinessName: string;
  availableBusinesses: DealershipOption[];
};

export function DealershipSwitcher({
  currentBusinessId,
  currentBusinessName,
  availableBusinesses,
}: DealershipSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSwitch(businessId: string) {
    if (businessId === currentBusinessId || switching) return;
    setSwitching(true);

    try {
      const res = await fetch("/api/auth/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to switch dealership context");
      }

      // Reload page so all Server Components re-resolve active dealership
      window.location.reload();
    } catch (err) {
      console.error("Dealership switch error", err);
      alert(err instanceof Error ? err.message : "Failed to switch dealership");
      setSwitching(false);
    }
  }

  // If user has only 1 dealership, display it simply without dropdown controls
  if (availableBusinesses.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="truncate max-w-[180px]">{currentBusinessName}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Switch dealership. Current active: ${currentBusinessName}`}
        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 shadow-xs text-xs font-semibold text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:outline-hidden cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[160px] text-left">{currentBusinessName}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Available Dealerships"
          className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50 focus:outline-hidden animate-in fade-in-50 zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-slate-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Switch Dealership ({availableBusinesses.length})
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {availableBusinesses.map((b) => {
              const isSelected = b.id === currentBusinessId;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={switching}
                  onClick={() => handleSwitch(b.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-red-50/80 text-red-900 font-bold"
                      : "text-slate-700 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate text-slate-900">{b.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      /{b.slug} • {b.role === "DEALER_ADMIN" ? "Admin" : "Member"}
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-red-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
