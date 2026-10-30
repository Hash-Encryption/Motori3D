export type ListingPublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PhysicalUnitStatus = "DRAFT" | "PUBLISHED" | "SOLD";

// Backward compatibility alias
export type VehicleLifecycleStatus = PhysicalUnitStatus;

export type VehicleListing = {
  id: string;
  businessId: string;
  title: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  bodyStyle: string | null;
  transmission: string | null;
  fuelType: string | null;
  price: number | null;
  description: string | null;
  status: ListingPublicationStatus;
  createdAt: string;
  updatedAt: string;
};

export type PhysicalInventoryUnit = {
  id: string;
  businessId: string;
  listingId: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  vin: string | null;
  stockNumber: string | null;
  mileage: number | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  status: PhysicalUnitStatus;
  createdAt: string;
  updatedAt: string;
  hasCapture: boolean;
  captureId: string | null;
  captureStatus: string | null;
  frameCount: number;
  isSpinReady: boolean;
};

export type ListingWithUnits = {
  listing: VehicleListing;
  units: PhysicalInventoryUnit[];
  availableUnitCount: number;
  totalUnitCount: number;
};

export type ListingInventorySummary = VehicleListing & {
  availableUnitCount: number;
  totalUnitCount: number;
  hasCapture: boolean;
  isSpinReady: boolean;
  captureId: string | null;
};

export type CreateVehicleListingInput = {
  title?: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  bodyStyle?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  price?: number | null;
  description?: string | null;
  status?: ListingPublicationStatus;
};

export type CreatePhysicalUnitInput = {
  id?: string;
  listingId?: string;
  vin?: string | null;
  stockNumber?: string | null;
  mileage?: number | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  status?: PhysicalUnitStatus;
};

export type CreateListingWithUnitInput = {
  listing: CreateVehicleListingInput;
  unit: CreatePhysicalUnitInput;
};

export type UpdateVehicleListingInput = Partial<CreateVehicleListingInput>;

export type UpdatePhysicalUnitInput = Partial<{
  vin: string | null;
  stockNumber: string | null;
  mileage: number | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  status: PhysicalUnitStatus;
}>;

export type ListingFilterOptions = {
  query?: string;
  status?: ListingPublicationStatus | "ALL";
};

export type ReassignUnitInput = {
  unitId: string;
  targetListingId: string;
};

// ==============================================================================
// Legacy Phase 04 types (retained for backward compatibility)
// ==============================================================================

export type InventoryVehicle = {
  id: string;
  businessId: string;
  listingId?: string;
  make: string;
  model: string;
  year: number;
  price: number | null;
  mileage: number | null;
  vin: string | null;
  stockNumber: string | null;
  trim: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  bodyStyle: string | null;
  transmission: string | null;
  fuelType: string | null;
  status: VehicleLifecycleStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateInventoryVehicleInput = {
  make: string;
  model: string;
  year: number;
  price?: number | null;
  mileage?: number | null;
  vin?: string | null;
  stockNumber?: string | null;
  trim?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  bodyStyle?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  status?: VehicleLifecycleStatus;
};

export type UpdateInventoryVehicleInput = Partial<CreateInventoryVehicleInput>;

export type InventoryFilterOptions = {
  query?: string;
  status?: VehicleLifecycleStatus;
};

export type EnrichedInventoryVehicle = InventoryVehicle & {
  hasCapture: boolean;
  captureId: string | null;
  captureStatus: string | null;
  frameCount: number;
  isSpinReady: boolean;
};
