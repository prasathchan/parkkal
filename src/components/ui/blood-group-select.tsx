"use client";

import { BLOOD_GROUPS } from "@/lib/schemas/patient";

const BLOOD_GROUP_OPTIONS = [
  { value: "", label: "Select Blood Group" },
  ...BLOOD_GROUPS.map((bg) => ({ value: bg, label: bg === "UNKNOWN" ? "Unknown / Not Tested" : bg === "Bombay Oh" ? "Bombay (Oh)" : bg })),
];

interface BloodGroupSelectProps {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
}

export function BloodGroupSelect({ value, onChange, required, className }: BloodGroupSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={`border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 w-full ${className ?? ""}`}
    >
      {BLOOD_GROUP_OPTIONS.map((bg) => (
        <option key={bg.value} value={bg.value} disabled={bg.value === ""}>
          {bg.label}
        </option>
      ))}
    </select>
  );
}
