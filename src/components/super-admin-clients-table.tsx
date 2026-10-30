"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlatformClientSummary } from "@/server/admin/super-admin-repository";

type SuperAdminClientsTableProps = {
  initialClients: PlatformClientSummary[];
};

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

export function SuperAdminClientsTable({ initialClients }: SuperAdminClientsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filteredClients = useMemo(() => {
    return initialClients.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [initialClients, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      ALL: initialClients.length,
      ACTIVE: initialClients.filter((c) => c.status === "ACTIVE").length,
      SUSPENDED: initialClients.filter((c) => c.status === "SUSPENDED").length,
    };
  }, [initialClients]);

  return (
    <div className="space-y-4">
      {/* Filters & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, or ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-red-600 transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["ALL", "ACTIVE", "SUSPENDED"] as const).map((status) => {
            const isSelected = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {status === "ALL" ? "All Clients" : status === "ACTIVE" ? "Active" : "Suspended"}{" "}
                <span className={`ml-1 text-[10px] ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                  ({counts[status]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Scanning */}
      <div className="text-xs font-semibold text-slate-500 px-1">
        Showing {filteredClients.length} of {initialClients.length} registered dealerships
      </div>

      {filteredClients.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-900">No dealerships match your filter</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try clearing your search query or selecting a different status filter to view persisted dealership accounts.
          </p>
          {(search || statusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
              className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Operational Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">Dealership / Slug</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Inventory Units</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{client.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">/{client.slug}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          client.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            client.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        {client.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {client.memberCount} {client.memberCount === 1 ? "user" : "users"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900">{client.vehicleCount}</span>{" "}
                      <span className="text-slate-400 text-[11px]">vehicles</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(client.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/super-admin/clients/${client.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Inspect
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{client.name}</h3>
                    <p className="text-xs font-mono text-slate-400">/{client.slug}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      client.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {client.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Members</span>
                    <span className="font-semibold text-slate-800">{client.memberCount} users</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicles</span>
                    <span className="font-semibold text-slate-800">{client.vehicleCount} units</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Created {new Date(client.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/super-admin/clients/${client.id}`}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors min-h-[44px]"
                  >
                    Inspect Client →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
