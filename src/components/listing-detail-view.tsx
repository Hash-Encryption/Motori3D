"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import type {
  ListingPublicationStatus,
  ListingWithUnits,
  PhysicalInventoryUnit,
  PhysicalUnitStatus,
  VehicleListing,
} from "@/server/vehicles/inventory-types";

type ListingDetailViewProps = {
  initialListing: ListingWithUnits;
  dealershipName: string;
};

export function ListingDetailView({
  initialListing,
  dealershipName,
}: ListingDetailViewProps) {
  const router = useRouter();
  const [listing, setListing] = useState<VehicleListing>(initialListing.listing);
  const [units, setUnits] = useState<PhysicalInventoryUnit[]>(initialListing.units || []);

  // UI state
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingListing, setIsDeletingListing] = useState(false);

  // New unit form state
  const [showAddUnitForm, setShowAddUnitForm] = useState(false);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [unitFormError, setUnitFormError] = useState<string | null>(null);

  // Reassignment state
  const [reassigningUnitId, setReassigningUnitId] = useState<string | null>(null);
  const [targetListingId, setTargetListingId] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [dealershipListings, setDealershipListings] = useState<
    Array<{ id: string; title: string; year: number; make: string; model: string }>
  >([]);

  // Unit inline edit state
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [editUnitError, setEditUnitError] = useState<string | null>(null);

  // Feedback notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Recompute available units
  const availableCount = units.filter((u) => u.status === "PUBLISHED").length;

  // Handle Listing Status Change (DRAFT, PUBLISHED, ARCHIVED)
  async function handleListingStatusChange(newStatus: ListingPublicationStatus) {
    if (newStatus === listing.status || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to update listing status.");
        return;
      }

      setListing((prev) => ({ ...prev, status: newStatus }));
      setSuccessMessage(`Listing status updated to ${newStatus}.`);
    } catch {
      setErrorMessage("Network error updating listing status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  // Handle Listing Specifications Save
  async function handleSaveSpecs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSpecs(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      make: formData.get("make"),
      model: formData.get("model"),
      year: formData.get("year"),
      trim: formData.get("trim") || null,
      price: formData.get("price") || null,
      bodyStyle: formData.get("bodyStyle") || null,
      transmission: formData.get("transmission") || null,
      fuelType: formData.get("fuelType") || null,
      description: formData.get("description") || null,
    };

    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to save listing specifications.");
        return;
      }

      setListing((prev) => ({
        ...prev,
        ...data.listing,
      }));
      setIsEditingSpecs(false);
      setSuccessMessage("Listing specifications saved.");
    } catch {
      setErrorMessage("Network error saving listing specifications.");
    } finally {
      setIsSavingSpecs(false);
    }
  }

  // Handle Add Physical Unit
  async function handleAddUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAddingUnit(true);
    setUnitFormError(null);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      stockNumber: formData.get("stockNumber") || null,
      vin: formData.get("vin") || null,
      mileage: formData.get("mileage") || null,
      exteriorColor: formData.get("exteriorColor") || null,
      interiorColor: formData.get("interiorColor") || null,
      status: formData.get("status") || "PUBLISHED",
    };

    try {
      const response = await fetch(`/api/listings/${listing.id}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setUnitFormError(data.error ?? "Failed to attach physical unit.");
        return;
      }

      setUnits((prev) => [data.unit, ...prev]);
      setShowAddUnitForm(false);
      setSuccessMessage("Physical inventory unit added successfully.");
    } catch {
      setUnitFormError("Network error adding physical unit.");
    } finally {
      setIsAddingUnit(false);
    }
  }

  // Handle Unit Status Toggle (DRAFT, PUBLISHED, SOLD)
  async function handleUnitStatusChange(unitId: string, newStatus: PhysicalUnitStatus) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/vehicles/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to update unit availability.");
        return;
      }

      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: newStatus } : u)),
      );
      setSuccessMessage(`Unit availability updated to ${newStatus}.`);
    } catch {
      setErrorMessage("Network error updating unit availability.");
    }
  }

  // Handle Save Physical Unit Details (VIN, Stock #, Mileage, Colors, Status)
  async function handleSaveUnit(event: FormEvent<HTMLFormElement>, unitId: string) {
    event.preventDefault();
    setIsSavingUnit(true);
    setEditUnitError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      stockNumber: formData.get("stockNumber") || null,
      vin: formData.get("vin") || null,
      mileage: formData.get("mileage") || null,
      exteriorColor: formData.get("exteriorColor") || null,
      interiorColor: formData.get("interiorColor") || null,
      status: formData.get("status") || "PUBLISHED",
    };

    try {
      const response = await fetch(`/api/vehicles/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setEditUnitError(data.error ?? "Failed to save unit details.");
        return;
      }

      setUnits((prev) =>
        prev.map((u) => {
          if (u.id !== unitId) return u;
          const v = data.vehicle;
          return {
            ...u,
            stockNumber: v?.stockNumber !== undefined ? v.stockNumber : u.stockNumber,
            vin: v?.vin !== undefined ? v.vin : u.vin,
            mileage: v?.mileage !== undefined ? v.mileage : u.mileage,
            exteriorColor: v?.exteriorColor !== undefined ? v.exteriorColor : u.exteriorColor,
            interiorColor: v?.interiorColor !== undefined ? v.interiorColor : u.interiorColor,
            status: (v?.status as PhysicalUnitStatus) || u.status,
          };
        }),
      );
      setEditingUnitId(null);
      setSuccessMessage("Physical inventory unit updated successfully.");
    } catch {
      setEditUnitError("Network error updating physical unit.");
    } finally {
      setIsSavingUnit(false);
    }
  }

  // Fetch dealership listings for reassignment target selection
  async function loadDealershipListings() {
    if (dealershipListings.length > 0) return;
    try {
      const res = await fetch("/api/listings");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.listings)) {
          setDealershipListings(data.listings);
        }
      }
    } catch {
      // Ignored fallback
    }
  }

  // Handle Unit Reassignment
  async function handleExecuteReassign(unitId: string) {
    if (!targetListingId.trim()) {
      setReassignError("Enter a valid target listing ID.");
      return;
    }

    setIsReassigning(true);
    setReassignError(null);

    try {
      const response = await fetch(`/api/vehicles/${unitId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetListingId: targetListingId.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        setReassignError(data.error ?? "Failed to reassign unit.");
        return;
      }

      // Remove unit from current listing view
      setUnits((prev) => prev.filter((u) => u.id !== unitId));
      setReassigningUnitId(null);
      setTargetListingId("");
      setSuccessMessage(
        `Physical unit ${unitId.slice(0, 8)} successfully reassigned to listing ${targetListingId.slice(0, 8)}.`,
      );
    } catch {
      setReassignError("Network error during unit reassignment.");
    } finally {
      setIsReassigning(false);
    }
  }

  // Handle Delete Listing (Safe non-destructive check)
  async function handleDeleteListing() {
    if (units.length > 0) {
      setErrorMessage(
        `Cannot delete listing with ${units.length} attached physical inventory unit(s). Set listing status to ARCHIVED instead, or remove/reassign attached units first.`,
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete this listing? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeletingListing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to delete listing.");
        return;
      }

      router.push("/vehicles");
      router.refresh();
    } catch {
      setErrorMessage("Network error deleting listing.");
    } finally {
      setIsDeletingListing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMessage ? (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4 flex items-start justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      ) : null}

      {successMessage ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl p-4 flex items-start justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Listing Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
              {dealershipName}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono text-slate-500">ID: {listing.id.slice(0, 8)}</span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {listing.year} {listing.make} {listing.model}
            {listing.trim ? ` ${listing.trim}` : ""}
          </h1>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Publication Status Badge */}
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                listing.status === "PUBLISHED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : listing.status === "ARCHIVED"
                    ? "bg-slate-100 text-slate-600 border-slate-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              Listing: {listing.status}
            </span>

            {/* Inventory Count Badge */}
            <span
              className={`text-xs font-medium px-2.5 py-0.5 rounded border ${
                availableCount > 0
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                  : units.length > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {availableCount} Available / {units.length} Total Physical Unit{units.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Listing Publication Actions */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <label htmlFor="listing-status-select" className="sr-only">
            Listing Status
          </label>
          <select
            id="listing-status-select"
            value={listing.status}
            onChange={(e) => handleListingStatusChange(e.target.value as ListingPublicationStatus)}
            disabled={isUpdatingStatus}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-red-600"
          >
            <option value="PUBLISHED">Set: PUBLISHED</option>
            <option value="DRAFT">Set: DRAFT</option>
            <option value="ARCHIVED">Set: ARCHIVED</option>
          </select>

          <button
            onClick={() => setIsEditingSpecs(!isEditingSpecs)}
            className="button button-secondary text-xs py-1.5"
            type="button"
          >
            {isEditingSpecs ? "Cancel Edit" : "Edit Specs"}
          </button>

          <button
            onClick={handleDeleteListing}
            disabled={isDeletingListing}
            className="text-xs font-medium text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
            type="button"
          >
            {isDeletingListing ? "Deleting…" : "Delete"}
          </button>
        </div>
      </section>

      {/* Marketable Specifications Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Marketable Vehicle Specifications</h2>
          <span className="text-xs text-slate-400">Canonical offer attributes</span>
        </div>

        {isEditingSpecs ? (
          <form onSubmit={handleSaveSpecs} className="space-y-4">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="spec-make">Make *</label>
                <input id="spec-make" name="make" defaultValue={listing.make} required maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="spec-model">Model *</label>
                <input id="spec-model" name="model" defaultValue={listing.model} required maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="spec-year">Year *</label>
                <input
                  id="spec-year"
                  name="year"
                  type="number"
                  defaultValue={listing.year}
                  required
                  min={1886}
                  max={new Date().getFullYear() + 1}
                />
              </div>
              <div className="field">
                <label htmlFor="spec-trim">Trim</label>
                <input id="spec-trim" name="trim" defaultValue={listing.trim ?? ""} maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="spec-price">Asking Price ($)</label>
                <input
                  id="spec-price"
                  name="price"
                  type="number"
                  defaultValue={listing.price ?? ""}
                  min={0}
                />
              </div>
              <div className="field">
                <label htmlFor="spec-bodyStyle">Body Style</label>
                <input id="spec-bodyStyle" name="bodyStyle" defaultValue={listing.bodyStyle ?? ""} maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="spec-transmission">Transmission</label>
                <input
                  id="spec-transmission"
                  name="transmission"
                  defaultValue={listing.transmission ?? ""}
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="spec-fuelType">Fuel Type</label>
                <input id="spec-fuelType" name="fuelType" defaultValue={listing.fuelType ?? ""} maxLength={60} />
              </div>
              <div className="field field-wide">
                <label htmlFor="spec-description">Marketing Description</label>
                <textarea
                  id="spec-description"
                  name="description"
                  defaultValue={listing.description ?? ""}
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsEditingSpecs(false)}
                className="button button-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" disabled={isSavingSpecs} className="button button-primary text-xs">
                {isSavingSpecs ? "Saving…" : "Save Specifications"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Asking Price</span>
              <span className="text-xl font-bold text-slate-900">
                {listing.price !== null ? `$${listing.price.toLocaleString()}` : "Unpriced"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Body Style</span>
              <span className="text-sm font-semibold text-slate-800">
                {listing.bodyStyle || "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Transmission</span>
              <span className="text-sm font-semibold text-slate-800">
                {listing.transmission || "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Fuel Type</span>
              <span className="text-sm font-semibold text-slate-800">
                {listing.fuelType || "Not specified"}
              </span>
            </div>
            {listing.description ? (
              <div className="col-span-2 sm:col-span-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 block font-medium mb-1">Marketing Description</span>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* PHYSICAL INVENTORY UNITS SECTION */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Physical Inventory Units ({units.length})
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                {availableCount} available
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual vehicles attached to this offer. 360 walkaround captures and VINs are tracked per physical unit.
            </p>
          </div>

          <button
            onClick={() => setShowAddUnitForm(!showAddUnitForm)}
            className="button button-primary text-xs self-start sm:self-auto py-1.5"
            type="button"
          >
            {showAddUnitForm ? "Cancel" : "+ Add Physical Unit"}
          </button>
        </div>

        {/* Add Physical Unit Inline Form */}
        {showAddUnitForm ? (
          <form
            onSubmit={handleAddUnit}
            className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Add New Physical Unit to Listing
              </h3>
              <span className="text-xs text-slate-500">Inherits {listing.year} {listing.make} {listing.model}</span>
            </div>

            {unitFormError ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {unitFormError}
              </div>
            ) : null}

            <div className="form-grid">
              <div className="field">
                <label htmlFor="unit-stock">Stock Number</label>
                <input
                  id="unit-stock"
                  name="stockNumber"
                  placeholder="e.g. STK-2002"
                  maxLength={64}
                  autoCapitalize="characters"
                />
              </div>

              <div className="field">
                <label htmlFor="unit-vin">VIN</label>
                <input
                  id="unit-vin"
                  name="vin"
                  placeholder="1HGCR2F83HA000000"
                  maxLength={20}
                  autoCapitalize="characters"
                />
              </div>

              <div className="field">
                <label htmlFor="unit-mileage">Mileage (miles)</label>
                <input
                  id="unit-mileage"
                  name="mileage"
                  type="number"
                  placeholder="8500"
                  min={0}
                />
              </div>

              <div className="field">
                <label htmlFor="unit-status">Initial Availability</label>
                <select id="unit-status" name="status" defaultValue="PUBLISHED">
                  <option value="PUBLISHED">PUBLISHED (Available)</option>
                  <option value="DRAFT">DRAFT (In preparation)</option>
                  <option value="SOLD">SOLD (Sold)</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="unit-exterior">Exterior Color</label>
                <input id="unit-exterior" name="exteriorColor" placeholder="e.g. Chalk" maxLength={60} />
              </div>

              <div className="field">
                <label htmlFor="unit-interior">Interior Color</label>
                <input id="unit-interior" name="interiorColor" placeholder="e.g. Black" maxLength={60} />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAddUnitForm(false)}
                className="button button-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" disabled={isAddingUnit} className="button button-primary text-xs">
                {isAddingUnit ? "Adding Unit…" : "Add Unit to Listing"}
              </button>
            </div>
          </form>
        ) : null}

        {/* Units List */}
        {units.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <p className="text-sm font-semibold text-slate-700">No physical units attached to this listing</p>
            <p className="text-xs text-slate-500 mt-1">
              Add a physical unit with stock number and VIN to capture 360 walkaround frames.
            </p>
            <button
              onClick={() => setShowAddUnitForm(true)}
              className="button button-primary text-xs mt-4"
              type="button"
            >
              + Add First Physical Unit
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {units.map((unit) => {
              const isReassigningThis = reassigningUnitId === unit.id;

              return (
                <article
                  key={unit.id}
                  className="border border-slate-200 rounded-xl p-5 bg-white hover:border-slate-300 transition-colors space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        {unit.stockNumber || "No Stock #"}
                      </span>

                      {/* Availability status badge */}
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                          unit.status === "PUBLISHED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : unit.status === "SOLD"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        Unit: {unit.status === "PUBLISHED" ? "Available" : unit.status}
                      </span>

                      {/* 360 Ready badge */}
                      {unit.isSpinReady ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          360 Ready
                        </span>
                      ) : null}
                    </div>

                    {/* Quick unit status toggle */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <label htmlFor={`unit-status-${unit.id}`} className="text-xs text-slate-400">
                        Availability:
                      </label>
                      <select
                        id={`unit-status-${unit.id}`}
                        value={unit.status}
                        onChange={(e) =>
                          handleUnitStatusChange(unit.id, e.target.value as PhysicalUnitStatus)
                        }
                        className="text-xs font-medium bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-red-600"
                      >
                        <option value="PUBLISHED">Available (PUBLISHED)</option>
                        <option value="DRAFT">In Prep (DRAFT)</option>
                        <option value="SOLD">Sold (SOLD)</option>
                      </select>
                    </div>
                  </div>

                  {/* Unit Specs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block">VIN</span>
                      <span className="font-mono font-medium text-slate-800">
                        {unit.vin || "No VIN"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mileage</span>
                      <span className="font-semibold text-slate-800">
                        {unit.mileage !== null ? `${unit.mileage.toLocaleString()} mi` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Exterior / Interior</span>
                      <span className="font-medium text-slate-800">
                        {unit.exteriorColor || "—"} / {unit.interiorColor || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Unit UUID (Protected)</span>
                      <span className="font-mono text-slate-500 text-[11px]" title={unit.id}>
                        {unit.id.slice(0, 13)}…
                      </span>
                    </div>
                  </div>

                  {/* Unit Action Bar: 360 viewer, Processing, Reassign */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {unit.isSpinReady ? (
                        <Link
                          href={`/vehicles/${unit.id}/viewer`}
                          className="button button-primary text-xs py-1 px-3"
                        >
                          View 360 Spin →
                        </Link>
                      ) : null}

                      <Link
                        href={`/vehicles/${unit.id}/processing`}
                        className="button button-secondary text-xs py-1 px-3"
                      >
                        360 Studio / Capture
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUnitId(editingUnitId === unit.id ? null : unit.id);
                          setEditUnitError(null);
                          setReassigningUnitId(null);
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200"
                      >
                        {editingUnitId === unit.id ? "Cancel Edit" : "Edit Unit"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next = isReassigningThis ? null : unit.id;
                          setReassigningUnitId(next);
                          setReassignError(null);
                          setEditingUnitId(null);
                          if (next) {
                            loadDealershipListings();
                          }
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200"
                      >
                        {isReassigningThis ? "Cancel Reassign" : "Reassign Unit"}
                      </button>
                    </div>
                  </div>

                  {/* Inline Physical Unit Edit Form */}
                  {editingUnitId === unit.id ? (
                    <form
                      onSubmit={(e) => handleSaveUnit(e, unit.id)}
                      className="bg-slate-50 border border-slate-300 rounded-xl p-4 mt-2 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Edit Physical Inventory Unit Details
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500">ID: {unit.id.slice(0, 8)}</span>
                      </div>

                      {editUnitError ? (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                          {editUnitError}
                        </div>
                      ) : null}

                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor={`edit-stock-${unit.id}`}>Stock Number</label>
                          <input
                            id={`edit-stock-${unit.id}`}
                            name="stockNumber"
                            defaultValue={unit.stockNumber ?? ""}
                            maxLength={64}
                            autoCapitalize="characters"
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`edit-vin-${unit.id}`}>VIN</label>
                          <input
                            id={`edit-vin-${unit.id}`}
                            name="vin"
                            defaultValue={unit.vin ?? ""}
                            maxLength={20}
                            autoCapitalize="characters"
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`edit-mileage-${unit.id}`}>Mileage</label>
                          <input
                            id={`edit-mileage-${unit.id}`}
                            name="mileage"
                            type="number"
                            defaultValue={unit.mileage ?? ""}
                            min={0}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`edit-status-${unit.id}`}>Availability Status</label>
                          <select id={`edit-status-${unit.id}`} name="status" defaultValue={unit.status}>
                            <option value="PUBLISHED">PUBLISHED (Available)</option>
                            <option value="DRAFT">DRAFT (In prep)</option>
                            <option value="SOLD">SOLD (Sold)</option>
                          </select>
                        </div>

                        <div className="field">
                          <label htmlFor={`edit-ext-${unit.id}`}>Exterior Color</label>
                          <input
                            id={`edit-ext-${unit.id}`}
                            name="exteriorColor"
                            defaultValue={unit.exteriorColor ?? ""}
                            maxLength={60}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`edit-int-${unit.id}`}>Interior Color</label>
                          <input
                            id={`edit-int-${unit.id}`}
                            name="interiorColor"
                            defaultValue={unit.interiorColor ?? ""}
                            maxLength={60}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingUnitId(null)}
                          className="button button-secondary text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingUnit}
                          className="button button-primary text-xs"
                        >
                          {isSavingUnit ? "Saving Unit…" : "Save Unit"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {/* Reassignment Popover */}
                  {isReassigningThis ? (
                    <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 mt-2 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Reassign Physical Unit to Different Listing
                        </h4>
                        <p className="text-xs text-slate-500">
                          Moves unit {unit.stockNumber || unit.id.slice(0, 8)} to another vehicle listing within this dealership.
                          Preserves unit UUID, captures, and 360 viewer assets.
                        </p>
                      </div>

                      {reassignError ? (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                          {reassignError}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {dealershipListings.filter((l) => l.id !== listing.id).length > 0 ? (
                          <div className="space-y-1">
                            <label htmlFor={`target-listing-select-${unit.id}`} className="text-xs text-slate-600 font-medium">
                              Select from dealership offers:
                            </label>
                            <select
                              id={`target-listing-select-${unit.id}`}
                              value={targetListingId}
                              onChange={(e) => setTargetListingId(e.target.value)}
                              className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-red-600"
                            >
                              <option value="">Choose target listing...</option>
                              {dealershipListings
                                .filter((l) => l.id !== listing.id)
                                .map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.title || `${l.year} ${l.make} ${l.model}`} (ID: {l.id.slice(0, 8)})
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Or enter Target Listing UUID directly..."
                            value={targetListingId}
                            onChange={(e) => setTargetListingId(e.target.value)}
                            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-red-600 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleExecuteReassign(unit.id)}
                            disabled={isReassigning}
                            className="button button-primary text-xs py-1.5 px-3"
                          >
                            {isReassigning ? "Reassigning…" : "Confirm Reassign"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
