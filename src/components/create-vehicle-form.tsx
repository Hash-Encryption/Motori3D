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
    | "status",
    string
  >
>;

type ApiError = {
  error?: string;
  fieldErrors?: FieldErrors;
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
      status: formData.get("status") || "DRAFT",
    };

    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiError;
      if (!response.ok) {
        setFormError(result.error ?? "The vehicle could not be saved.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      const vehicleId = result.vehicle?.id;
      if (vehicleId) {
        router.push(`/vehicles/${vehicleId}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch {
      setFormError("The server could not be reached. Check network connectivity.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError ? (
        <div className="form-error" role="alert">
          {formError}
        </div>
      ) : null}

      <div className="form-grid">
        {/* Make */}
        <div className="field">
          <label htmlFor="make">Make *</label>
          <input
            id="make"
            name="make"
            placeholder="e.g. Toyota, BMW, Ford"
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
            placeholder="e.g. Camry, M3, F-150"
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
            placeholder="e.g. XLE, Competition, Lariat"
            maxLength={60}
          />
        </div>

        {/* Price */}
        <div className="field">
          <label htmlFor="price">
            Price ($) <span className="optional">Optional</span>
          </label>
          <input
            id="price"
            name="price"
            type="number"
            inputMode="numeric"
            placeholder="35000"
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
            placeholder="15400"
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

        {/* Stock Number */}
        <div className="field">
          <label htmlFor="stockNumber">
            Stock Number <span className="optional">Optional</span>
          </label>
          <input
            id="stockNumber"
            name="stockNumber"
            placeholder="STK-9042"
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

        {/* Exterior Color */}
        <div className="field">
          <label htmlFor="exteriorColor">
            Exterior Color <span className="optional">Optional</span>
          </label>
          <input
            id="exteriorColor"
            name="exteriorColor"
            placeholder="Midnight Black"
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
            placeholder="Charcoal Leather"
            maxLength={60}
          />
        </div>

        {/* Body Style */}
        <div className="field">
          <label htmlFor="bodyStyle">
            Body Style <span className="optional">Optional</span>
          </label>
          <select id="bodyStyle" name="bodyStyle" defaultValue="">
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

        {/* Initial Status */}
        <div className="field">
          <label htmlFor="status">Initial Status</label>
          <select id="status" name="status" defaultValue="DRAFT">
            <option value="DRAFT">DRAFT (Not published)</option>
            <option value="PUBLISHED">PUBLISHED (Active inventory)</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <Link className="button button-secondary" href="/">
          Cancel
        </Link>
        <button className="button button-primary" type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Inventory Vehicle"}
        </button>
      </div>
    </form>
  );
}
