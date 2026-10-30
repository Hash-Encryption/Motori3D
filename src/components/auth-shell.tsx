import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[64px] flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2.5 font-extrabold text-slate-900 tracking-tight text-lg">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs flex items-center justify-center font-black tracking-tighter relative">
              V360
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
            </span>
            <span>Vehicle 360</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/sign-in"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors min-h-[40px]"
            >
              Sign In
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-colors min-h-[40px]"
            >
              Create Dealership
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
