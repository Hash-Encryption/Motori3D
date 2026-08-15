"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import type {
  EnrichedInventoryVehicle,
  VehicleLifecycleStatus,
} from "@/server/vehicles/inventory-types";

type VehicleDetailViewProps = {
  initialVehicle: EnrichedInventoryVehicle;
  dealershipName: string;
};

const statusConfig: Record<
  VehicleLifecycleStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: "Draft",
    bg: "bg-stone-800",
    text: "text-stone-300",
    border: "border-stone-700",
  },
  PUBLISHED: {
    label: "Published",
    bg: "bg-emerald-950/60",
    text: "text-emerald-300",
    border: "border-emerald-700/50",
  },
  SOLD: {
    label: "Sold",
    bg: "bg-amber-950/60",
    text: "text-amber-300",
    border: "border-amber-700/50",
  },
};

export function VehicleDetailView({
  initialVehicle,
  dealershipName,
}: VehicleDetailViewProps) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<EnrichedInventoryVehicle>(initialVehicle);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleStatusChange(newStatus: VehicleLifecycleStatus) {
    if (newStatus === vehicle.status || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to update lifecycle status.");
        return;
      }

      setVehicle((prev) => ({ ...prev, status: newStatus }));
      setSuccessMessage(`Vehicle status changed to ${newStatus}.`);
    } catch {
      setErrorMessage("Network error updating status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleSaveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      make: formData.get("make"),
      model: formData.get("model"),
      year: formData.get("year"),
      price: formData.get("price") || null,
      mileage: formData.get("mileage") || null,
      vin: formData.get("vin") || null,
      stockNumber: formData.get("stockNumber") || null,
      trim: formData.get("trim") || null,
      exteriorColor: formData.get("exteriorColor") || null,
      interiorColor: formData.get("interiorColor") || null,
      bodyStyle: formData.get("bodyStyle") || null,
      transmission: formData.get("transmission") || null,
      fuelType: formData.get("fuelType") || null,
    };

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to save vehicle details.");
        return;
      }

      setVehicle((prev) => ({
        ...prev,
        ...data.vehicle,
      }));
      setIsEditing(false);
      setSuccessMessage("Vehicle specifications updated successfully.");
      router.refresh();
    } catch {
      setErrorMessage("Network error saving vehicle details.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (vehicle.hasCapture) {
      setErrorMessage(
        "Cannot delete vehicle with attached captures or 360 media. Processing evidence is protected. Set status to SOLD instead.",
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${vehicle.year} ${vehicle.make} ${vehicle.model}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Failed to delete vehicle.");
        setIsDeleting(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Network error during vehicle deletion.");
      setIsDeleting(false);
    }
  }

  const currentStatus = statusConfig[vehicle.status] ?? statusConfig.DRAFT;

  return (
    <div className="space-y-6">
      {/* Messages */}
      {errorMessage && (
        <div className="form-error" role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-700/60 rounded-lg text-emerald-200 text-sm">
          {successMessage}
        </div>
      )}

      {/* Header & Lifecycle Control */}
      <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono uppercase text-stone-400">
                {dealershipName}
              </span>
              <span className="text-stone-600">•</span>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
              >
                {currentStatus.label}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.trim ? (
                <span className="text-stone-400 font-normal ml-2">
                  {vehicle.trim}
                </span>
              ) : null}
            </h1>
            <p className="text-xs text-stone-500 font-mono mt-1">
              ID: {vehicle.id}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Dropdown */}
            <div className="flex items-center gap-2 bg-stone-950 p-1.5 rounded-lg border border-stone-800">
              <span className="text-xs text-stone-400 px-2 font-medium">
                Lifecycle:
              </span>
              <select
                value={vehicle.status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as VehicleLifecycleStatus)
                }
                disabled={isUpdatingStatus}
                className="text-xs bg-stone-900 border border-stone-700 text-stone-200 rounded px-2.5 py-1 font-semibold focus:outline-none focus:border-amber-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="SOLD">Sold</option>
              </select>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="button button-secondary text-xs"
              type="button"
            >
              {isEditing ? "Cancel Edit" : "Edit Specifications"}
            </button>
          </div>
        </div>
      </section>

      {/* 360 Processing & Interactive Spin Card */}
      <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400 font-bold text-sm">360° Interactive</span>
              <span className="text-stone-600">•</span>
              {vehicle.isSpinReady ? (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready ({vehicle.frameCount} frames)
                </span>
              ) : vehicle.hasCapture ? (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {vehicle.captureStatus ?? "Processing"}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-stone-800 text-stone-400 border border-stone-700">
                  Awaiting Walkaround Video
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-white">
              {vehicle.isSpinReady
                ? "360 Spin Sequence Active"
                : vehicle.hasCapture
                  ? "360 Capture in Pipeline"
                  : "No 360 Capture Uploaded"}
            </h2>
            <p className="text-sm text-stone-400 mt-1 max-w-xl">
              {vehicle.isSpinReady
                ? "Interactive ordered frames are ready for full drag-and-spin inspection."
                : vehicle.hasCapture
                  ? "Video is uploaded and processing into an interactive frame sequence."
                  : "Upload one phone walkaround video to generate an interactive 360 viewer."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {vehicle.isSpinReady ? (
              <Link
                href={`/vehicles/${vehicle.id}/viewer`}
                className="button button-primary text-sm whitespace-nowrap"
              >
                Open 360 Viewer →
              </Link>
            ) : (
              <Link
                href={`/vehicles/${vehicle.id}/processing`}
                className="button button-primary text-sm whitespace-nowrap"
              >
                {vehicle.hasCapture ? "Open Processing" : "Upload Video"}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Edit Form OR Specifications Display */}
      {isEditing ? (
        <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-md">
          <h2 className="text-xl font-bold text-white mb-4">Edit Vehicle Specifications</h2>
          <form onSubmit={handleSaveDetails} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="make">Make *</label>
                <input
                  id="make"
                  name="make"
                  defaultValue={vehicle.make}
                  required
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="model">Model *</label>
                <input
                  id="model"
                  name="model"
                  defaultValue={vehicle.model}
                  required
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="year">Year *</label>
                <input
                  id="year"
                  name="year"
                  type="number"
                  defaultValue={vehicle.year}
                  required
                  min={1886}
                  max={new Date().getFullYear() + 1}
                />
              </div>
              <div className="field">
                <label htmlFor="trim">Trim</label>
                <input
                  id="trim"
                  name="trim"
                  defaultValue={vehicle.trim ?? ""}
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="price">Price ($)</label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  defaultValue={vehicle.price ?? ""}
                  min={0}
                />
              </div>
              <div className="field">
                <label htmlFor="mileage">Mileage (miles)</label>
                <input
                  id="mileage"
                  name="mileage"
                  type="number"
                  defaultValue={vehicle.mileage ?? ""}
                  min={0}
                />
              </div>
              <div className="field">
                <label htmlFor="stockNumber">Stock Number</label>
                <input
                  id="stockNumber"
                  name="stockNumber"
                  defaultValue={vehicle.stockNumber ?? ""}
                  maxLength={64}
                />
              </div>
              <div className="field">
                <label htmlFor="vin">VIN</label>
                <input
                  id="vin"
                  name="vin"
                  defaultValue={vehicle.vin ?? ""}
                  maxLength={20}
                />
              </div>
              <div className="field">
                <label htmlFor="exteriorColor">Exterior Color</label>
                <input
                  id="exteriorColor"
                  name="exteriorColor"
                  defaultValue={vehicle.exteriorColor ?? ""}
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="interiorColor">Interior Color</label>
                <input
                  id="interiorColor"
                  name="interiorColor"
                  defaultValue={vehicle.interiorColor ?? ""}
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="bodyStyle">Body Style</label>
                <select id="bodyStyle" name="bodyStyle" defaultValue={vehicle.bodyStyle ?? ""}>
                  <option value="">Select body style...</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Truck">Truck</option>
                  <option value="Coupe">Coupe</option>
                  <option value="Convertible">Convertible</option>
                  <option value="Hatchback">Hatchback</option>
                  <option value="Wagon">Wagon</option>
                  <option value="Van">Van</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="transmission">Transmission</label>
                <select id="transmission" name="transmission" defaultValue={vehicle.transmission ?? ""}>
                  <option value="">Select transmission...</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                  <option value="Dual-Clutch">Dual-Clutch</option>
                  <option value="CVT">CVT</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fuelType">Fuel Type</label>
                <select id="fuelType" name="fuelType" defaultValue={vehicle.fuelType ?? ""}>
                  <option value="">Select fuel type...</option>
                  <option value="Gasoline">Gasoline</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                  <option value="Plug-in Hybrid">Plug-in Hybrid</option>
                  <option value="Diesel">Diesel</option>
                </select>
              </div>
            </div>

            <div className="form-actions mt-6">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="button button-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="button button-primary"
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold text-white mb-4 border-b border-stone-800 pb-3">
            Inventory Details & Specifications
          </h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Price</dt>
              <dd className="text-base font-semibold text-white mt-1">
                {vehicle.price !== null
                  ? `$${vehicle.price.toLocaleString()}`
                  : "Unpriced"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Mileage</dt>
              <dd className="text-base font-semibold text-white mt-1">
                {vehicle.mileage !== null
                  ? `${vehicle.mileage.toLocaleString()} mi`
                  : "Not recorded"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Stock #</dt>
              <dd className="font-mono text-sm font-semibold text-stone-200 mt-1">
                {vehicle.stockNumber ?? "None"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">VIN</dt>
              <dd className="font-mono text-xs text-stone-300 mt-1 break-all">
                {vehicle.vin ?? "None"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Exterior</dt>
              <dd className="text-sm font-medium text-stone-200 mt-1">
                {vehicle.exteriorColor ?? "Not specified"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Interior</dt>
              <dd className="text-sm font-medium text-stone-200 mt-1">
                {vehicle.interiorColor ?? "Not specified"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Body Style</dt>
              <dd className="text-sm font-medium text-stone-200 mt-1">
                {vehicle.bodyStyle ?? "Not specified"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Transmission</dt>
              <dd className="text-sm font-medium text-stone-200 mt-1">
                {vehicle.transmission ?? "Not specified"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Fuel Type</dt>
              <dd className="text-sm font-medium text-stone-200 mt-1">
                {vehicle.fuelType ?? "Not specified"}
              </dd>
            </div>
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800/80">
              <dt className="text-xs text-stone-500 uppercase tracking-wider">Created</dt>
              <dd className="text-xs text-stone-400 mt-1">
                {new Date(vehicle.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Danger Zone: Safe Delete */}
      <section className="bg-stone-950 border border-red-950/60 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              Danger Zone
            </h3>
            <p className="text-xs text-stone-400 mt-1 max-w-lg">
              {vehicle.hasCapture
                ? "This vehicle has attached 360 capture evidence and cannot be deleted. Change status to SOLD to archive it."
                : "Permanently remove this vehicle inventory record. Only allowed for vehicles without captures."}
            </p>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting || vehicle.hasCapture}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
              vehicle.hasCapture
                ? "bg-stone-900 text-stone-600 cursor-not-allowed border border-stone-800"
                : "bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800"
            }`}
            type="button"
          >
            {isDeleting ? "Deleting…" : "Delete Vehicle"}
          </button>
        </div>
      </section>
    </div>
  );
}
