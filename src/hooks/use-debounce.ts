/**
 * hooks/use-debounce.ts
 *
 * Delays updating a value until the user stops typing.
 * Used in all search inputs so we don't fire an API call on every keystroke.
 *
 * HOW TO USE:
 *   const [searchInput, setSearchInput] = useState("");
 *   const search = useDebounce(searchInput, 300); // waits 300ms after typing stops
 *
 *   // Now use `search` (not searchInput) to trigger API calls
 *   useEffect(() => { fetchPatients(search) }, [search]);
 */

"use client";

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
