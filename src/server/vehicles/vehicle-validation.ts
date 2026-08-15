export type CreateVehicleInput = {
  name: string;
  make: string;
  model: string;
  year: number;
  stockIdentifier: string | null;
};

export type VehicleFieldErrors = Partial<
  Record<"name" | "make" | "model" | "year" | "stockIdentifier", string>
>;

type ValidationResult =
  | { ok: true; value: CreateVehicleInput }
  | { ok: false; errors: VehicleFieldErrors };

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateCreateVehicle(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { name: "Enter the vehicle details." } };
  }

  const candidate = input as Record<string, unknown>;
  const name = cleanString(candidate.name);
  const make = cleanString(candidate.make);
  const model = cleanString(candidate.model);
  const stockIdentifier = cleanString(candidate.stockIdentifier);
  const parsedYear =
    typeof candidate.year === "number"
      ? candidate.year
      : Number.parseInt(cleanString(candidate.year), 10);
  const maximumYear = new Date().getFullYear() + 1;
  const errors: VehicleFieldErrors = {};

  if (name.length < 2 || name.length > 100) {
    errors.name = "Enter a vehicle name between 2 and 100 characters.";
  }
  if (make.length < 1 || make.length > 60) {
    errors.make = "Enter a make between 1 and 60 characters.";
  }
  if (model.length < 1 || model.length > 60) {
    errors.model = "Enter a model between 1 and 60 characters.";
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > maximumYear) {
    errors.year = `Enter a year between 1886 and ${maximumYear}.`;
  }
  if (stockIdentifier.length > 64) {
    errors.stockIdentifier = "Use 64 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      make,
      model,
      year: parsedYear,
      stockIdentifier: stockIdentifier || null,
    },
  };
}
