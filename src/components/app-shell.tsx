import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="Vehicle 360 projects">
            <span className="brand-mark" aria-hidden="true">
              V360
            </span>
            <span>Vehicle 360</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="text-xs font-semibold px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors"
            >
              Account
            </Link>
            <span className="environment-label">Hybrid SaaS</span>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
