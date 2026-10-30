"use client";

import { useState } from "react";
import type { BusinessStatus } from "@/server/auth/types";
import { toggleDealershipStatusAction } from "@/app/super-admin/clients/[id]/actions";

type SuperAdminStatusToggleProps = {
  businessId: string;
  businessName: string;
  initialStatus: BusinessStatus;
};

export function SuperAdminStatusToggle({
  businessId,
  businessName,
  initialStatus,
}: SuperAdminStatusToggleProps) {
  const [status, setStatus] = useState<BusinessStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  const isCurrentlyActive = status === "ACTIVE";
  const targetStatus: BusinessStatus = isCurrentlyActive ? "SUSPENDED" : "ACTIVE";

  async function handleToggle() {
    const actionName = isCurrentlyActive ? "suspend" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionName} "${businessName}"?`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await toggleDealershipStatusAction(businessId, targetStatus);
      setStatus(targetStatus);
    } catch (err) {
      console.error("Failed to update status", err);
      alert(err instanceof Error ? err.message : "Failed to update dealership status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
          isCurrentlyActive
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full mr-1.5 ${
            isCurrentlyActive ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        {status}
      </span>

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 min-h-[36px] ${
          isCurrentlyActive
            ? "text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
            : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
        }`}
      >
        {loading
          ? "Updating..."
          : isCurrentlyActive
            ? "Suspend Dealership"
            : "Activate Dealership"}
      </button>
    </div>
  );
}
