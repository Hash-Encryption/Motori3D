export type VehicleLifecycleStatus = "DRAFT" | "PUBLISHED" | "SOLD";

export type InventoryVehicle = {
  id: string;
  businessId: string;
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
