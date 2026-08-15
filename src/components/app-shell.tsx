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
          <span className="environment-label">Local MVP</span>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
