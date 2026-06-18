"use client";

/**
 * LocationContext — tracks which branch the current user is viewing.
 *
 * Rules:
 *  - Single-branch org: selectedLocationId is always null, selector hidden.
 *  - Multi-branch org:
 *      ADMIN / MANAGER: see all locations, free to switch, default = "All".
 *      Other roles with a primary location: auto-select their branch, locked
 *        (canSwitchLocation = false) — they never see another branch's data.
 *      Other roles without a primary location: default = "All", can switch freely.
 *  - Selection is persisted in localStorage for ADMIN/MANAGER only.
 */

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react";
import { locationsApi, authApi } from "@/api";
import type { Location } from "@/types";

const STORAGE_KEY = "pk-selected-location";
const SWITCHABLE_ROLES = new Set(["ADMIN", "MANAGER"]);

interface LocationContextValue {
  locations:           Location[];
  selectedLocationId:  string | null;   // null = "All Locations"
  setSelectedLocationId: (id: string | null) => void;
  selectedLocation:    Location | null;
  isMultiBranch:       boolean;
  canSwitchLocation:   boolean;         // false = user is locked to their branch
  loading:             boolean;
}

const LocationContext = createContext<LocationContextValue>({
  locations:             [],
  selectedLocationId:    null,
  setSelectedLocationId: () => {},
  selectedLocation:      null,
  isMultiBranch:         false,
  canSwitchLocation:     true,
  loading:               true,
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations]               = useState<Location[]>([]);
  const [selectedLocationId, setSelectedRaw]    = useState<string | null>(null);
  const [canSwitchLocation, setCanSwitch]       = useState(true);
  const [loading, setLoading]                   = useState(true);

  useEffect(() => {
    Promise.all([locationsApi.list(), authApi.me()])
      .then(([{ locations: locs }, meData]) => {
        setLocations(locs);

        const role            = meData?.user?.role ?? "STAFF";
        const primaryLocId    = meData?.user?.primaryLocationId ?? null;
        const canSwitch       = SWITCHABLE_ROLES.has(role);
        setCanSwitch(canSwitch);

        const active = locs.filter((l) => l.isActive);

        if (!canSwitch && primaryLocId && active.some((l) => l.id === primaryLocId)) {
          // Non-admin with a primary location → lock to it silently
          setSelectedRaw(primaryLocId);
        } else if (canSwitch) {
          // Admin/Manager → restore from localStorage
          const stored = typeof localStorage !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
          const valid = stored && locs.some((l) => l.id === stored && l.isActive);
          setSelectedRaw(valid ? stored : null);
        }
        // else: no primary location, no restriction → stay on "All Locations"
      })
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, []);

  const setSelectedLocationId = useCallback((id: string | null) => {
    if (!canSwitchLocation) return; // locked users cannot change
    setSelectedRaw(id);
    if (typeof localStorage !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else    localStorage.removeItem(STORAGE_KEY);
    }
  }, [canSwitchLocation]);

  const activeCount     = locations.filter((l) => l.isActive).length;
  const isMultiBranch   = activeCount > 1;
  const selectedLocation = selectedLocationId
    ? (locations.find((l) => l.id === selectedLocationId) ?? null)
    : null;

  return (
    <LocationContext.Provider value={{
      locations, selectedLocationId, setSelectedLocationId,
      selectedLocation, isMultiBranch, canSwitchLocation, loading,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
