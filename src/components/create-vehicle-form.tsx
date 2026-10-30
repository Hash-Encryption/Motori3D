"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type FieldErrors = Partial<
  Record<
    | "make"
    | "model"
    | "year"
    | "price"
    | "mileage"
    | "vin"
    | "stockNumber"
    | "trim"
    | "exteriorColor"
    | "interiorColor"
    | "bodyStyle"
    | "transmission"
    | "fuelType"
    | "description"
    | "status"
    | "listingStatus"
    | "unitStatus",
    string
  >
>;

type ApiResponse = {
  error?: string;
  fieldErrors?: FieldErrors;
  listing?: { id: string };
  unit?: { id: string };
  vehicle?: { id: string };
};

export function CreateVehicleForm() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);

    const payload = {
      listing: {
        make: formData.get("make"),
        model: formData.get("model"),
        year: formData.get("year"),
        trim: formData.get("trim") || null,
        bodyStyle: formData.get("bodyStyle") || null,
        transmission: formData.get("transmission") || null,
        fuelType: formData.get("fuelType") || null,
        price: formData.get("price") || null,
        description: formData.get("description") || null,
        status: formData.get("listingStatus") || "PUBLISHED",
      },
      unit: {
        stockNumber: formData.get("stockNumber") || null,
        vin: formData.get("vin") || null,
        mileage: formData.get("mileage") || null,
        exteriorColor: formData.get("exteriorColor") || null,
        interiorColor: formData.get("interiorColor") || null,
        status: formData.get("unitStatus") || "PUBLISHED",
      },
    };

    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setFormError(result.error ?? "The listing could not be saved.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      const listingId = result.listing?.id;
      if (listingId) {
        router.push(`/vehicles/${listingId}`);
      } else {
        router.push("/vehicles");
      }
      router.refresh();
    } catch {
      setFormError("The server could not be reached. Check network connectivity.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {formError ? (
        <div className="form-error" role="alert">
          {formError}
        </div>
      ) : null}

      {/* SECTION 1: Marketable Vehicle Listing */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Marketable Vehicle Listing
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Canonical vehicle offer attributes shared across attached physical inventory units.
          </p>
        </div>

        <div className="form-grid">
          {/* Make */}
          <div className="field">
            <label htmlFor="make">Make *</label>
            <input
              id="make"
              name="make"
              placeholder="e.g. Porsche, BMW, Toyota"
              required
              maxLength={60}
              aria-describedby={fieldErrors.make ? "make-error" : undefined}
              aria-invalid={Boolean(fieldErrors.make)}
            />
            {fieldErrors.make ? (
              <span className="field-error" id="make-error">
                {fieldErrors.make}
              </span>
            ) : null}
          </div>

          {/* Model */}
          <div className="field">
            <label htmlFor="model">Model *</label>
            <input
              id="model"
              name="model"
              placeholder="e.g. 911 GT3, M3, Camry"
              required
              maxLength={60}
              aria-describedby={fieldErrors.model ? "model-error" : undefined}
              aria-invalid={Boolean(fieldErrors.model)}
            />
            {fieldErrors.model ? (
              <span className="field-error" id="model-error">
                {fieldErrors.model}
              </span>
            ) : null}
          </div>

          {/* Year */}
          <div className="field">
            <label htmlFor="year">Year *</label>
            <input
              id="year"
              name="year"
              type="number"
              inputMode="numeric"
              placeholder="2024"
              min={1886}
              max={new Date().getFullYear() + 1}
              required
              aria-describedby={fieldErrors.year ? "year-error" : undefined}
              aria-invalid={Boolean(fieldErrors.year)}
            />
            {fieldErrors.year ? (
              <span className="field-error" id="year-error">
                {fieldErrors.year}
              </span>
            ) : null}
          </div>

          {/* Trim */}
          <div className="field">
            <label htmlFor="trim">
              Trim <span className="optional">Optional</span>
            </label>
            <input
              id="trim"
              name="trim"
              placeholder="e.g. Touring, Competition, XLE"
              maxLength={60}
            />
          </div>

          {/* Asking Price */}
          <div className="field">
            <label htmlFor="price">
              Asking Price ($) <span className="optional">Optional</span>
            </label>
            <input
              id="price"
              name="price"
              type="number"
              inputMode="numeric"
              placeholder="125000"
              min={0}
              aria-describedby={fieldErrors.price ? "price-error" : undefined}
              aria-invalid={Boolean(fieldErrors.price)}
            />
            {fieldErrors.price ? (
              <span className="field-error" id="price-error">
                {fieldErrors.price}
              </span>
            ) : null}
          </div>

          {/* Body Style */}
          <div className="field">
            <label htmlFor="bodyStyle">
              Body Style <span className="optional">Optional</span>
            </label>
            <select id="bodyStyle" name="bodyStyle" defaultValue="">
              <option value="">Select body style...</option>
              <option value="Coupe">Coupe</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Truck">Truck</option>
              <option value="Convertible">Convertible</option>
              <option value="Hatchback">Hatchback</option>
              <option value="Wagon">Wagon</option>
              <option value="Van">Van</option>
            </select>
          </div>

          {/* Transmission */}
          <div className="field">
            <label htmlFor="transmission">
              Transmission <span className="optional">Optional</span>
            </label>
            <select id="transmission" name="transmission" defaultValue="">
              <option value="">Select transmission...</option>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="Dual-Clutch">Dual-Clutch</option>
              <option value="CVT">CVT</option>
            </select>
          </div>

          {/* Fuel Type */}
          <div className="field">
            <label htmlFor="fuelType">
              Fuel Type <span className="optional">Optional</span>
            </label>
            <select id="fuelType" name="fuelType" defaultValue="">
              <option value="">Select fuel type...</option>
              <option value="Gasoline">Gasoline</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
              <option value="Plug-in Hybrid">Plug-in Hybrid</option>
              <option value="Diesel">Diesel</option>
            </select>
          </div>

          {/* Listing Publication Status */}
          <div className="field">
            <label htmlFor="listingStatus">Listing Publication Status</label>
            <select id="listingStatus" name="listingStatus" defaultValue="PUBLISHED">
              <option value="PUBLISHED">PUBLISHED (Active offer)</option>
              <option value="DRAFT">DRAFT (Draft offer)</option>
              <option value="ARCHIVED">ARCHIVED (Archived)</option>
            </select>
          </div>

          {/* Description */}
          <div className="field field-wide">
            <label htmlFor="description">
              Marketing Description <span className="optional">Optional</span>
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="Highlight key packages, condition notes, and selling points..."
              rows={3}
              maxLength={2000}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Initial Physical Inventory Unit */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Initial Physical Inventory Unit
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            The first physical vehicle tied to this offer. 360 walkaround captures and VIN belong to this unit.
          </p>
        </div>

        <div className="form-grid">
          {/* Stock Number */}
          <div className="field">
            <label htmlFor="stockNumber">
              Stock Number <span className="optional">Optional</span>
            </label>
            <input
              id="stockNumber"
              name="stockNumber"
              placeholder="e.g. STK-1001"
              maxLength={64}
              autoCapitalize="characters"
              aria-describedby={fieldErrors.stockNumber ? "stock-error" : undefined}
              aria-invalid={Boolean(fieldErrors.stockNumber)}
            />
            {fieldErrors.stockNumber ? (
              <span className="field-error" id="stock-error">
                {fieldErrors.stockNumber}
              </span>
            ) : null}
          </div>

          {/* VIN */}
          <div className="field">
            <label htmlFor="vin">
              VIN <span className="optional">Optional</span>
            </label>
            <input
              id="vin"
              name="vin"
              placeholder="1HGCR2F83HA000000"
              maxLength={20}
              autoCapitalize="characters"
              aria-describedby={fieldErrors.vin ? "vin-error" : undefined}
              aria-invalid={Boolean(fieldErrors.vin)}
            />
            {fieldErrors.vin ? (
              <span className="field-error" id="vin-error">
                {fieldErrors.vin}
              </span>
            ) : null}
          </div>

          {/* Mileage */}
          <div className="field">
            <label htmlFor="mileage">
              Mileage (miles) <span className="optional">Optional</span>
            </label>
            <input
              id="mileage"
              name="mileage"
              type="number"
              inputMode="numeric"
              placeholder="12450"
              min={0}
              aria-describedby={fieldErrors.mileage ? "mileage-error" : undefined}
              aria-invalid={Boolean(fieldErrors.mileage)}
            />
            {fieldErrors.mileage ? (
              <span className="field-error" id="mileage-error">
                {fieldErrors.mileage}
              </span>
            ) : null}
          </div>

          {/* Physical Unit Status */}
          <div className="field">
            <label htmlFor="unitStatus">Physical Unit Availability</label>
            <select id="unitStatus" name="unitStatus" defaultValue="PUBLISHED">
              <option value="PUBLISHED">PUBLISHED (Available in inventory)</option>
              <option value="DRAFT">DRAFT (In preparation)</option>
              <option value="SOLD">SOLD (Sold unit)</option>
            </select>
          </div>

          {/* Exterior Color */}
          <div className="field">
            <label htmlFor="exteriorColor">
              Exterior Color <span className="optional">Optional</span>
            </label>
            <input
              id="exteriorColor"
              name="exteriorColor"
              placeholder="e.g. Shark Blue"
              maxLength={60}
            />
          </div>

          {/* Interior Color */}
          <div className="field">
            <label htmlFor="interiorColor">
              Interior Color <span className="optional">Optional</span>
            </label>
            <input
              id="interiorColor"
              name="interiorColor"
              placeholder="e.g. Black Leather / Race-Tex"
              maxLength={60}
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link className="button button-secondary" href="/vehicles">
          Cancel
        </Link>
        <button className="button button-primary" type="submit" disabled={isSaving}>
          {isSaving ? "Creating Listing & Unit…" : "Create Listing & Unit"}
        </button>
      </div>
    </form>
  );
}
