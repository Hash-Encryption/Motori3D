"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  BusinessRecord,
  DealerRole,
} from "@/server/auth/types";
import type {
  EnrichedInventoryVehicle,
  ListingInventorySummary,
  ListingPublicationStatus,
} from "@/server/vehicles/inventory-types";

type InventoryDashboardProps = {
  initialListings?: ListingInventorySummary[];
  initialVehicles?: EnrichedInventoryVehicle[];
  business: BusinessRecord;
  role: DealerRole;
};

type FilterStatus = "ALL" | ListingPublicationStatus;

export function InventoryDashboard({
  initialListings,
  initialVehicles,
  business,
  role,
}: InventoryDashboardProps) {
  // Normalize items to listings
  const normalizedListings: ListingInventorySummary[] = useMemo(() => {
    if (initialListings && initialListings.length > 0) {
      return initialListings;
    }
    // Fallback: convert legacy vehicles to listing summaries
    return (initialVehicles || []).map((v) => ({
      id: v.listingId || v.id,
      businessId: v.businessId,
      title: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
      make: v.make,
      model: v.model,
      year: v.year,
      trim: v.trim,
      bodyStyle: v.bodyStyle,
      transmission: v.transmission,
      fuelType: v.fuelType,
      price: v.price,
      description: null,
      status: (v.status === "SOLD" ? "ARCHIVED" : (v.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")) as ListingPublicationStatus,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      availableUnitCount: v.status === "PUBLISHED" ? 1 : 0,
      totalUnitCount: 1,
      hasCapture: v.hasCapture,
      isSpinReady: v.isSpinReady,
      captureId: v.captureId,
    }));
  }, [initialListings, initialVehicles]);

  const [listings] = useState<ListingInventorySummary[]>(normalizedListings);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const searchable = [
          item.title,
          item.make,
          item.model,
          String(item.year),
          item.trim ?? "",
          item.bodyStyle ?? "",
          item.transmission ?? "",
          item.fuelType ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [listings, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    return {
      ALL: listings.length,
      DRAFT: listings.filter((l) => l.status === "DRAFT").length,
      PUBLISHED: listings.filter((l) => l.status === "PUBLISHED").length,
      ARCHIVED: listings.filter((l) => l.status === "ARCHIVED").length,
    };
  }, [listings]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="page-heading">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">{business.name}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-mono">
              {role === "DEALER_ADMIN" ? "Admin" : "Member"}
            </span>
          </div>
          <h1>Vehicle Listings & Inventory</h1>
          <p className="page-description">
            Manage your customer-facing vehicle offers and track individual physical units with 360 viewer assets.
          </p>
        </div>
        <Link className="button button-primary" href="/vehicles/new">
          <span aria-hidden="true">+</span>
          New Listing
        </Link>
      </section>

      {/* Search & Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            placeholder="Search make, model, year, trim…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg px-3.5 py-2 pl-9 placeholder-slate-400 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-start sm:self-auto overflow-x-auto">
          {(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === st
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
              type="button"
            >
              {st === "ALL" ? "All Offers" : st.charAt(0) + st.slice(1).toLowerCase()}{" "}
              <span className="text-slate-500 font-mono ml-0.5">({counts[st]})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Inventory Grid / List */}
      {listings.length === 0 ? (
        <section className="empty-state" aria-labelledby="empty-title">
          <div className="empty-mark" aria-hidden="true">
            360°
          </div>
          <div>
            <h2 id="empty-title">No vehicle listings yet</h2>
            <p>
              Create your first vehicle listing to market offers and associate physical inventory cars.
            </p>
          </div>
          <Link className="button button-primary" href="/vehicles/new">
            Create First Listing
          </Link>
        </section>
      ) : filteredListings.length === 0 ? (
        <section className="empty-state py-12" aria-labelledby="no-matches-title">
          <div>
            <h2 id="no-matches-title" className="text-lg">No matching vehicle offers</h2>
            <p className="text-sm text-slate-500 mt-1">
              No listings matched your search and filter criteria.
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
        <section aria-label="Dealership Vehicle Listings">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredListings.map((item) => {
              const hasUnits = item.totalUnitCount > 0;
              const hasAvailable = item.availableUnitCount > 0;

              return (
                <article
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Top status & availability badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {/* Listing Publication Badge */}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            item.status === "PUBLISHED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : item.status === "ARCHIVED"
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          Listing: {item.status}
                        </span>

                        {/* 360 Spin status */}
                        {item.isSpinReady ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            360 Ready
                          </span>
                        ) : null}
                      </div>

                      {/* Physical Inventory Availability Badge */}
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                          hasAvailable
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                            : hasUnits
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {hasAvailable
                          ? `${item.availableUnitCount} Available Unit${item.availableUnitCount > 1 ? "s" : ""}`
                          : hasUnits
                            ? "0 Available (Sold out)"
                            : "0 Units Attached"}
                      </span>
                    </div>

                    {/* Listing Title & Specs */}
                    <div>
                      <h2 className="text-base font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h2>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        {item.bodyStyle && <span>{item.bodyStyle}</span>}
                        {item.bodyStyle && item.transmission && <span>•</span>}
                        {item.transmission && <span>{item.transmission}</span>}
                        {item.transmission && item.fuelType && <span>•</span>}
                        {item.fuelType && <span>{item.fuelType}</span>}
                      </div>
                    </div>

                    {/* Price & Summary */}
                    <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Asking Price</span>
                        <span className="text-lg font-bold text-slate-900">
                          {item.price !== null ? `$${item.price.toLocaleString()}` : "Unpriced"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-medium">Total Managed</span>
                        <span className="text-sm font-semibold text-slate-700">
                          {item.totalUnitCount} physical unit{item.totalUnitCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2">
                    <Link
                      className="button button-secondary text-xs flex-1 text-center py-1.5"
                      href={`/vehicles/${item.id}`}
                    >
                      Manage Listing & Units
                    </Link>
                    {item.isSpinReady && item.captureId ? (
                      <Link
                        className="button button-primary text-xs flex-1 text-center py-1.5"
                        href={`/vehicles/${item.id}/viewer`}
                      >
                        360 View
                      </Link>
                    ) : (
                      <Link
                        className="button button-secondary text-xs flex-1 text-center py-1.5 text-slate-600"
                        href={`/vehicles/${item.id}`}
                      >
                        View Units
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
