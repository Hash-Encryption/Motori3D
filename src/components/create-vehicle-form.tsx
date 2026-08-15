"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type FieldErrors = Partial<
  Record<"name" | "make" | "model" | "year" | "stockIdentifier", string>
>;

type ApiError = {
  error?: string;
  fieldErrors?: FieldErrors;
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
      name: formData.get("name"),
      make: formData.get("make"),
      model: formData.get("model"),
      year: formData.get("year"),
      stockIdentifier: formData.get("stockIdentifier"),
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

      router.push("/");
      router.refresh();
    } catch {
      setFormError("The server could not be reached. Check that it is running.");
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
        <div className="field field-wide">
          <label htmlFor="name">Vehicle name</label>
          <input
            id="name"
            name="name"
            placeholder="Toyota Camry 2021"
            required
            maxLength={100}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? (
            <span className="field-error" id="name-error">
              {fieldErrors.name}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="make">Make</label>
          <input
            id="make"
            name="make"
            placeholder="Toyota"
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
        <div className="field">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            name="model"
            placeholder="Camry"
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
        <div className="field">
          <label htmlFor="year">Year</label>
          <input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            placeholder="2021"
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
        <div className="field">
          <label htmlFor="stockIdentifier">
            Stock or VIN identifier <span className="optional">Optional</span>
          </label>
          <input
            id="stockIdentifier"
            name="stockIdentifier"
            placeholder="STK-1042"
            maxLength={64}
            autoCapitalize="characters"
            aria-describedby={
              fieldErrors.stockIdentifier ? "stock-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.stockIdentifier)}
          />
          {fieldErrors.stockIdentifier ? (
            <span className="field-error" id="stock-error">
              {fieldErrors.stockIdentifier}
            </span>
          ) : null}
        </div>
      </div>

      <div className="form-actions">
        <Link className="button button-secondary" href="/">
          Cancel
        </Link>
        <button className="button button-primary" type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
