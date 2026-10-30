import type {
  CreateInventoryVehicleInput,
  CreateListingWithUnitInput,
  CreatePhysicalUnitInput,
  CreateVehicleListingInput,
  ListingPublicationStatus,
  PhysicalUnitStatus,
  ReassignUnitInput,
  UpdateInventoryVehicleInput,
  UpdatePhysicalUnitInput,
  UpdateVehicleListingInput,
  VehicleLifecycleStatus,
} from "./inventory-types";

export type CreateVehicleInput = {
  name: string;
  make: string;
  model: string;
  year: number;
  stockIdentifier: string | null;
};

export type VehicleFieldErrors = Partial<
  Record<
    | "name"
    | "make"
    | "model"
    | "year"
    | "price"
    | "mileage"
    | "vin"
    | "stockNumber"
    | "stockIdentifier"
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

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: VehicleFieldErrors };

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown, maxLength = 64): string | null {
  if (value === null || value === undefined) return null;
  const s = cleanString(value);
  return s.length > 0 ? s.slice(0, maxLength) : null;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(cleanString(value));
  return Number.isFinite(num) ? num : null;
}

export function validateCreateVehicle(input: unknown): ValidationResult<CreateVehicleInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { name: "Enter the vehicle details." } };
  }

  const candidate = input as Record<string, unknown>;
  const name = cleanString(candidate.name);
  const make = cleanString(candidate.make);
  const model = cleanString(candidate.model);
  const stockIdentifier = cleanOptionalString(
    candidate.stockIdentifier ?? candidate.stock_identifier ?? candidate.stockNumber ?? candidate.stock_number,
    64,
  );
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
      stockIdentifier,
    },
  };
}

export function validateCreateInventoryVehicle(
  input: unknown,
): ValidationResult<CreateInventoryVehicleInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { make: "Enter the vehicle details." } };
  }

  const candidate = input as Record<string, unknown>;
  const make = cleanString(candidate.make);
  const model = cleanString(candidate.model);
  const parsedYear =
    typeof candidate.year === "number"
      ? candidate.year
      : Number.parseInt(cleanString(candidate.year), 10);
  const maximumYear = new Date().getFullYear() + 1;
  const errors: VehicleFieldErrors = {};

  if (make.length < 1 || make.length > 60) {
    errors.make = "Make must be between 1 and 60 characters.";
  }
  if (model.length < 1 || model.length > 60) {
    errors.model = "Model must be between 1 and 60 characters.";
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > maximumYear) {
    errors.year = `Year must be between 1886 and ${maximumYear}.`;
  }

  // Optional price validation (must be >= 0 if supplied)
  const price = cleanNumber(candidate.price);
  if (candidate.price !== undefined && candidate.price !== null && candidate.price !== "") {
    if (price === null || price < 0) {
      errors.price = "Price must be a positive number.";
    }
  }

  // Optional mileage validation (must be >= 0 integer if supplied)
  const mileage = cleanNumber(candidate.mileage);
  if (candidate.mileage !== undefined && candidate.mileage !== null && candidate.mileage !== "") {
    if (mileage === null || mileage < 0 || !Number.isInteger(mileage)) {
      errors.mileage = "Mileage must be a positive whole number.";
    }
  }

  // Optional VIN validation (normalize uppercase, max 20 chars)
  const rawVin = cleanString(candidate.vin);
  const vin = rawVin.length > 0 ? rawVin.toUpperCase().slice(0, 20) : null;
  if (rawVin.length > 20) {
    errors.vin = "VIN must be 20 characters or fewer.";
  }

  // Optional stock number
  const stockNumber = cleanOptionalString(
    candidate.stockNumber ?? candidate.stock_number ?? candidate.stockIdentifier,
    64,
  );

  // Optional specifications
  const trim = cleanOptionalString(candidate.trim, 60);
  const exteriorColor = cleanOptionalString(
    candidate.exteriorColor ?? candidate.exterior_color,
    60,
  );
  const interiorColor = cleanOptionalString(
    candidate.interiorColor ?? candidate.interior_color,
    60,
  );
  const bodyStyle = cleanOptionalString(
    candidate.bodyStyle ?? candidate.body_style,
    60,
  );
  const transmission = cleanOptionalString(candidate.transmission, 60);
  const fuelType = cleanOptionalString(candidate.fuelType ?? candidate.fuel_type, 60);

  // Status validation
  const rawStatus = cleanString(candidate.status).toUpperCase();
  let status: VehicleLifecycleStatus = "DRAFT";
  if (rawStatus) {
    if (["DRAFT", "PUBLISHED", "SOLD"].includes(rawStatus)) {
      status = rawStatus as VehicleLifecycleStatus;
    } else {
      errors.status = "Status must be DRAFT, PUBLISHED, or SOLD.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      make,
      model,
      year: parsedYear,
      price: price !== null && price >= 0 ? Math.round(price) : null,
      mileage: mileage !== null && mileage >= 0 ? Math.round(mileage) : null,
      vin,
      stockNumber,
      trim,
      exteriorColor,
      interiorColor,
      bodyStyle,
      transmission,
      fuelType,
      status,
    },
  };
}

export function validateUpdateInventoryVehicle(
  input: unknown,
): ValidationResult<UpdateInventoryVehicleInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { make: "Invalid update payload." } };
  }

  const candidate = input as Record<string, unknown>;
  const errors: VehicleFieldErrors = {};
  const value: UpdateInventoryVehicleInput = {};
  const maximumYear = new Date().getFullYear() + 1;

  if (candidate.make !== undefined) {
    const make = cleanString(candidate.make);
    if (make.length < 1 || make.length > 60) {
      errors.make = "Make must be between 1 and 60 characters.";
    } else {
      value.make = make;
    }
  }

  if (candidate.model !== undefined) {
    const model = cleanString(candidate.model);
    if (model.length < 1 || model.length > 60) {
      errors.model = "Model must be between 1 and 60 characters.";
    } else {
      value.model = model;
    }
  }

  if (candidate.year !== undefined) {
    const parsedYear =
      typeof candidate.year === "number"
        ? candidate.year
        : Number.parseInt(cleanString(candidate.year), 10);
    if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > maximumYear) {
      errors.year = `Year must be between 1886 and ${maximumYear}.`;
    } else {
      value.year = parsedYear;
    }
  }

  if (candidate.price !== undefined) {
    if (candidate.price === null || candidate.price === "") {
      value.price = null;
    } else {
      const price = cleanNumber(candidate.price);
      if (price === null || price < 0) {
        errors.price = "Price must be a positive number.";
      } else {
        value.price = Math.round(price);
      }
    }
  }

  if (candidate.mileage !== undefined) {
    if (candidate.mileage === null || candidate.mileage === "") {
      value.mileage = null;
    } else {
      const mileage = cleanNumber(candidate.mileage);
      if (mileage === null || mileage < 0 || !Number.isInteger(mileage)) {
        errors.mileage = "Mileage must be a positive whole number.";
      } else {
        value.mileage = Math.round(mileage);
      }
    }
  }

  if (candidate.vin !== undefined) {
    if (candidate.vin === null || candidate.vin === "") {
      value.vin = null;
    } else {
      const rawVin = cleanString(candidate.vin);
      if (rawVin.length > 20) {
        errors.vin = "VIN must be 20 characters or fewer.";
      } else {
        value.vin = rawVin.toUpperCase();
      }
    }
  }

  if (candidate.stockNumber !== undefined || candidate.stock_number !== undefined) {
    const rawStock = candidate.stockNumber ?? candidate.stock_number;
    value.stockNumber = cleanOptionalString(rawStock, 64);
  }

  if (candidate.trim !== undefined) {
    value.trim = cleanOptionalString(candidate.trim, 60);
  }
  if (candidate.exteriorColor !== undefined || candidate.exterior_color !== undefined) {
    value.exteriorColor = cleanOptionalString(
      candidate.exteriorColor ?? candidate.exterior_color,
      60,
    );
  }
  if (candidate.interiorColor !== undefined || candidate.interior_color !== undefined) {
    value.interiorColor = cleanOptionalString(
      candidate.interiorColor ?? candidate.interior_color,
      60,
    );
  }
  if (candidate.bodyStyle !== undefined || candidate.body_style !== undefined) {
    value.bodyStyle = cleanOptionalString(
      candidate.bodyStyle ?? candidate.body_style,
      60,
    );
  }
  if (candidate.transmission !== undefined) {
    value.transmission = cleanOptionalString(candidate.transmission, 60);
  }
  if (candidate.fuelType !== undefined || candidate.fuel_type !== undefined) {
    value.fuelType = cleanOptionalString(candidate.fuelType ?? candidate.fuel_type, 60);
  }

  if (candidate.status !== undefined) {
    const rawStatus = cleanString(candidate.status).toUpperCase();
    if (["DRAFT", "PUBLISHED", "SOLD"].includes(rawStatus)) {
      value.status = rawStatus as VehicleLifecycleStatus;
    } else {
      errors.status = "Status must be DRAFT, PUBLISHED, or SOLD.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

// ==============================================================================
// Phase 06: Vehicle Listing & Physical Unit Validations
// ==============================================================================

export function validateCreateVehicleListing(
  input: unknown,
): ValidationResult<CreateVehicleListingInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { make: "Enter listing specifications." } };
  }

  const candidate = input as Record<string, unknown>;
  const errors: VehicleFieldErrors = {};
  const make = cleanString(candidate.make);
  const model = cleanString(candidate.model);
  const parsedYear =
    typeof candidate.year === "number"
      ? candidate.year
      : Number.parseInt(cleanString(candidate.year), 10);
  const maximumYear = new Date().getFullYear() + 1;

  if (make.length < 1 || make.length > 60) {
    errors.make = "Make must be between 1 and 60 characters.";
  }
  if (model.length < 1 || model.length > 60) {
    errors.model = "Model must be between 1 and 60 characters.";
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > maximumYear) {
    errors.year = `Year must be between 1886 and ${maximumYear}.`;
  }

  const price = cleanNumber(candidate.price);
  if (candidate.price !== undefined && candidate.price !== null && candidate.price !== "") {
    if (price === null || price < 0) {
      errors.price = "Price must be a positive number.";
    }
  }

  const trim = cleanOptionalString(candidate.trim, 60);
  const bodyStyle = cleanOptionalString(candidate.bodyStyle ?? candidate.body_style, 60);
  const transmission = cleanOptionalString(candidate.transmission, 60);
  const fuelType = cleanOptionalString(candidate.fuelType ?? candidate.fuel_type, 60);
  const description = cleanOptionalString(candidate.description, 2000);

  const rawStatus = cleanString(candidate.status).toUpperCase();
  let status: ListingPublicationStatus = "DRAFT";
  if (rawStatus) {
    if (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(rawStatus)) {
      status = rawStatus as ListingPublicationStatus;
    } else {
      errors.status = "Listing status must be DRAFT, PUBLISHED, or ARCHIVED.";
    }
  }

  const titleRaw = cleanString(candidate.title);
  const title = titleRaw.length > 0
    ? titleRaw.slice(0, 120)
    : [parsedYear, make, model, trim].filter(Boolean).join(" ");

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title,
      make,
      model,
      year: parsedYear,
      trim,
      bodyStyle,
      transmission,
      fuelType,
      price: price !== null && price >= 0 ? Math.round(price) : null,
      description,
      status,
    },
  };
}

export function validateUpdateVehicleListing(
  input: unknown,
): ValidationResult<UpdateVehicleListingInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { make: "Invalid update payload." } };
  }

  const candidate = input as Record<string, unknown>;
  const errors: VehicleFieldErrors = {};
  const value: UpdateVehicleListingInput = {};
  const maximumYear = new Date().getFullYear() + 1;

  if (candidate.title !== undefined) {
    const title = cleanString(candidate.title);
    if (title.length < 1 || title.length > 120) {
      errors.name = "Title must be between 1 and 120 characters.";
    } else {
      value.title = title;
    }
  }

  if (candidate.make !== undefined) {
    const make = cleanString(candidate.make);
    if (make.length < 1 || make.length > 60) {
      errors.make = "Make must be between 1 and 60 characters.";
    } else {
      value.make = make;
    }
  }

  if (candidate.model !== undefined) {
    const model = cleanString(candidate.model);
    if (model.length < 1 || model.length > 60) {
      errors.model = "Model must be between 1 and 60 characters.";
    } else {
      value.model = model;
    }
  }

  if (candidate.year !== undefined) {
    const parsedYear =
      typeof candidate.year === "number"
        ? candidate.year
        : Number.parseInt(cleanString(candidate.year), 10);
    if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > maximumYear) {
      errors.year = `Year must be between 1886 and ${maximumYear}.`;
    } else {
      value.year = parsedYear;
    }
  }

  if (candidate.price !== undefined) {
    const price = cleanNumber(candidate.price);
    if (price !== null && price < 0) {
      errors.price = "Price must be a positive number.";
    } else {
      value.price = price !== null ? Math.round(price) : null;
    }
  }

  if (candidate.trim !== undefined) {
    value.trim = cleanOptionalString(candidate.trim, 60);
  }
  if (candidate.bodyStyle !== undefined || candidate.body_style !== undefined) {
    value.bodyStyle = cleanOptionalString(candidate.bodyStyle ?? candidate.body_style, 60);
  }
  if (candidate.transmission !== undefined) {
    value.transmission = cleanOptionalString(candidate.transmission, 60);
  }
  if (candidate.fuelType !== undefined || candidate.fuel_type !== undefined) {
    value.fuelType = cleanOptionalString(candidate.fuelType ?? candidate.fuel_type, 60);
  }
  if (candidate.description !== undefined) {
    value.description = cleanOptionalString(candidate.description, 2000);
  }

  if (candidate.status !== undefined) {
    const rawStatus = cleanString(candidate.status).toUpperCase();
    if (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(rawStatus)) {
      value.status = rawStatus as ListingPublicationStatus;
    } else {
      errors.status = "Listing status must be DRAFT, PUBLISHED, or ARCHIVED.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

export function validateCreatePhysicalUnit(
  input: unknown,
): ValidationResult<CreatePhysicalUnitInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { vin: "Enter unit details." } };
  }

  const candidate = input as Record<string, unknown>;
  const errors: VehicleFieldErrors = {};

  const vin = cleanOptionalString(candidate.vin, 20);
  if (vin && !/^[A-HJ-NPR-Z0-9]{11,20}$/i.test(vin)) {
    errors.vin = "Enter a valid VIN (11-20 alphanumeric characters, excluding I, O, Q).";
  }

  const stockNumber = cleanOptionalString(
    candidate.stockNumber ?? candidate.stock_number ?? candidate.stockIdentifier ?? candidate.stock_identifier,
    64,
  );

  const mileage = cleanNumber(candidate.mileage);
  if (candidate.mileage !== undefined && candidate.mileage !== null && candidate.mileage !== "") {
    if (mileage === null || mileage < 0) {
      errors.mileage = "Mileage must be a positive number.";
    }
  }

  const exteriorColor = cleanOptionalString(
    candidate.exteriorColor ?? candidate.exterior_color,
    60,
  );
  const interiorColor = cleanOptionalString(
    candidate.interiorColor ?? candidate.interior_color,
    60,
  );

  const rawStatus = cleanString(candidate.status).toUpperCase();
  let status: PhysicalUnitStatus = "PUBLISHED";
  if (rawStatus) {
    if (["DRAFT", "PUBLISHED", "SOLD"].includes(rawStatus)) {
      status = rawStatus as PhysicalUnitStatus;
    } else {
      errors.status = "Physical unit status must be DRAFT, PUBLISHED, or SOLD.";
    }
  }

  const listingId = cleanOptionalString(candidate.listingId ?? candidate.listing_id, 36);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      listingId: listingId ?? undefined,
      vin,
      stockNumber,
      mileage: mileage !== null && mileage >= 0 ? Math.round(mileage) : null,
      exteriorColor,
      interiorColor,
      status,
    },
  };
}

export function validateUpdatePhysicalUnit(
  input: unknown,
): ValidationResult<UpdatePhysicalUnitInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { vin: "Invalid unit update payload." } };
  }

  const candidate = input as Record<string, unknown>;
  const errors: VehicleFieldErrors = {};
  const value: UpdatePhysicalUnitInput = {};

  if (candidate.vin !== undefined) {
    const vin = cleanOptionalString(candidate.vin, 20);
    if (vin && !/^[A-HJ-NPR-Z0-9]{11,20}$/i.test(vin)) {
      errors.vin = "Enter a valid VIN (11-20 alphanumeric characters, excluding I, O, Q).";
    } else {
      value.vin = vin;
    }
  }

  if (candidate.stockNumber !== undefined || candidate.stock_number !== undefined) {
    value.stockNumber = cleanOptionalString(
      candidate.stockNumber ?? candidate.stock_number,
      64,
    );
  }

  if (candidate.mileage !== undefined) {
    const mileage = cleanNumber(candidate.mileage);
    if (mileage !== null && mileage < 0) {
      errors.mileage = "Mileage must be a positive number.";
    } else {
      value.mileage = mileage !== null ? Math.round(mileage) : null;
    }
  }

  if (candidate.exteriorColor !== undefined || candidate.exterior_color !== undefined) {
    value.exteriorColor = cleanOptionalString(
      candidate.exteriorColor ?? candidate.exterior_color,
      60,
    );
  }

  if (candidate.interiorColor !== undefined || candidate.interior_color !== undefined) {
    value.interiorColor = cleanOptionalString(
      candidate.interiorColor ?? candidate.interior_color,
      60,
    );
  }

  if (candidate.status !== undefined) {
    const rawStatus = cleanString(candidate.status).toUpperCase();
    if (["DRAFT", "PUBLISHED", "SOLD"].includes(rawStatus)) {
      value.status = rawStatus as PhysicalUnitStatus;
    } else {
      errors.status = "Physical unit status must be DRAFT, PUBLISHED, or SOLD.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

export function validateCreateListingWithUnit(
  input: unknown,
): ValidationResult<CreateListingWithUnitInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { make: "Enter vehicle details." } };
  }

  const candidate = input as Record<string, unknown>;

  // Support either nested { listing, unit } or flat combined object
  const listingInput = (candidate.listing && typeof candidate.listing === "object")
    ? candidate.listing
    : candidate;

  const unitInput = (candidate.unit && typeof candidate.unit === "object")
    ? candidate.unit
    : candidate;

  const listingResult = validateCreateVehicleListing(listingInput);
  const unitResult = validateCreatePhysicalUnit(unitInput);

  const errors: VehicleFieldErrors = {
    ...(!listingResult.ok ? listingResult.errors : {}),
    ...(!unitResult.ok ? unitResult.errors : {}),
  };

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      listing: (listingResult as { ok: true; value: CreateVehicleListingInput }).value,
      unit: (unitResult as { ok: true; value: CreatePhysicalUnitInput }).value,
    },
  };
}

export function validateReassignUnit(
  input: unknown,
): ValidationResult<ReassignUnitInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { name: "Invalid reassignment payload." } };
  }

  const candidate = input as Record<string, unknown>;
  const unitId = cleanString(candidate.unitId ?? candidate.unit_id);
  const targetListingId = cleanString(candidate.targetListingId ?? candidate.target_listing_id);
  const errors: VehicleFieldErrors = {};

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!unitId || !uuidRegex.test(unitId)) {
    errors.name = "A valid unit ID is required.";
  }
  if (!targetListingId || !uuidRegex.test(targetListingId)) {
    errors.model = "A valid target listing ID is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      unitId,
      targetListingId,
    },
  };
}
