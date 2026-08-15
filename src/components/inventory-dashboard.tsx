"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  BusinessRecord,
  DealerRole,
} from "@/server/auth/types";
import type {
  EnrichedInventoryVehicle,
  VehicleLifecycleStatus,
} from "@/server/vehicles/inventory-types";

type InventoryDashboardProps = {
  initialVehicles: EnrichedInventoryVehicle[];
  business: BusinessRecord;
  role: DealerRole;
};

type FilterStatus = "ALL" | VehicleLifecycleStatus;

export function InventoryDashboard({
  initialVehicles,
  business,
  role,
}: InventoryDashboardProps) {
  const [vehicles] = useState<EnrichedInventoryVehicle[]>(initialVehicles);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Status filter
      if (statusFilter !== "ALL" && v.status !== statusFilter) {
        return false;
      }

      // Search filter across make, model, year, VIN, stockNumber
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const searchable = [
          v.make,
          v.model,
          String(v.year),
          v.trim ?? "",
          v.vin ?? "",
          v.stockNumber ?? "",
          v.exteriorColor ?? "",
          v.bodyStyle ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [vehicles, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    return {
      ALL: vehicles.length,
      DRAFT: vehicles.filter((v) => v.status === "DRAFT").length,
      PUBLISHED: vehicles.filter((v) => v.status === "PUBLISHED").length,
      SOLD: vehicles.filter((v) => v.status === "SOLD").length,
    };
  }, [vehicles]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="page-heading">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">{business.name}</span>
            <span className="text-stone-600">•</span>
            <span className="text-xs text-stone-400 font-mono">
              {role === "DEALER_ADMIN" ? "Admin" : "Member"}
            </span>
          </div>
          <h1>Vehicle Inventory</h1>
          <p className="page-description">
            Manage your dealership inventory and connect each vehicle to an interactive 360 viewer.
          </p>
        </div>
        <Link className="button button-primary" href="/vehicles/new">
          <span aria-hidden="true">+</span>
          New vehicle
        </Link>
      </section>

      {/* Search & Filter Bar */}
      <section className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            placeholder="Search make, model, VIN, stock #…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-sm rounded-lg px-3.5 py-2 pl-9 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-stone-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs self-start sm:self-auto overflow-x-auto">
          {(["ALL", "DRAFT", "PUBLISHED", "SOLD"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === st
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
              }`}
              type="button"
            >
              {st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}{" "}
              <span className="text-stone-500 font-mono ml-0.5">({counts[st]})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Inventory Grid / List */}
      {vehicles.length === 0 ? (
        <section className="empty-state" aria-labelledby="empty-title">
          <div className="empty-mark" aria-hidden="true">
            360°
          </div>
          <div>
            <h2 id="empty-title">No vehicles in inventory</h2>
            <p>
              Add your first dealership vehicle to manage specs and capture interactive 360 sequences.
            </p>
          </div>
          <Link className="button button-primary" href="/vehicles/new">
            Add first vehicle
          </Link>
        </section>
      ) : filteredVehicles.length === 0 ? (
        <section className="empty-state py-12" aria-labelledby="no-matches-title">
          <div>
            <h2 id="no-matches-title" className="text-lg">No matching vehicles</h2>
            <p className="text-sm text-stone-400 mt-1">
              No vehicles matched your search and filter criteria.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="button button-secondary text-xs"
            type="button"
          >
            Clear filters
          </button>
        </section>
      ) : (
        <section aria-label="Dealership Vehicles">
          <ul className="vehicle-grid">
            {filteredVehicles.map((v) => {
              const isReady = v.isSpinReady;
              return (
                <li className="vehicle-card" key={v.id}>
                  <div className="vehicle-card-preview" aria-hidden="true">
                    <span>360°</span>
                    {isReady && (
                      <span className="absolute bottom-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                        {v.frameCount} Frames
                      </span>
                    )}
                  </div>

                  <div className="vehicle-card-body">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {/* Lifecycle badge */}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            v.status === "PUBLISHED"
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                              : v.status === "SOLD"
                                ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                                : "bg-stone-800 text-stone-300 border-stone-700"
                          }`}
                        >
                          {v.status}
                        </span>

                        {/* 360 Spin status */}
                        {isReady ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            360 Ready
                          </span>
                        ) : v.hasCapture ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Processing
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-stone-900 text-stone-500 border border-stone-800">
                            No 360
                          </span>
                        )}
                      </div>

                      <h2 className="text-base font-bold text-white leading-snug">
                        {v.year} {v.make} {v.model}
                        {v.trim ? (
                          <span className="text-stone-400 font-normal text-sm ml-1.5">
                            {v.trim}
                          </span>
                        ) : null}
                      </h2>

                      <div className="mt-2 text-xs text-stone-400 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span>
                            {v.price !== null ? `$${v.price.toLocaleString()}` : "Unpriced"}
                          </span>
                          <span>
                            {v.mileage !== null ? `${v.mileage.toLocaleString()} mi` : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[11px] text-stone-500">
                          <span>Stk: {v.stockNumber ?? "—"}</span>
                          <span>VIN: {v.vin ? v.vin.slice(-8) : "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-800/60">
                      <Link
                        className="button button-secondary text-xs flex-1 text-center"
                        href={`/vehicles/${v.id}`}
                      >
                        Details
                      </Link>
                      {isReady ? (
                        <Link
                          className="button button-primary text-xs flex-1 text-center"
                          href={`/vehicles/${v.id}/viewer`}
                        >
                          360 View
                        </Link>
                      ) : (
                        <Link
                          className="button button-secondary text-xs flex-1 text-center"
                          href={`/vehicles/${v.id}/processing`}
                        >
                          {v.hasCapture ? "Processing" : "Capture"}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
