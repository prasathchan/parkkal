"use client";

const BLOOD_GROUPS = [
  { value: "", label: "Select Blood Group" },
  { value: "O+", label: "O+" },
  { value: "O−", label: "O−" },
  { value: "A+", label: "A+" },
  { value: "A−", label: "A−" },
  { value: "B+", label: "B+" },
  { value: "B−", label: "B−" },
  { value: "AB+", label: "AB+" },
  { value: "AB−", label: "AB−" },
  { value: "A1+", label: "A1+" },
  { value: "A1−", label: "A1−" },
  { value: "A2+", label: "A2+" },
  { value: "A2−", label: "A2−" },
  { value: "A1B+", label: "A1B+" },
  { value: "A1B−", label: "A1B−" },
  { value: "A2B+", label: "A2B+" },
  { value: "A2B−", label: "A2B−" },
  { value: "Bombay (Oh)", label: "Bombay (Oh)" },
  { value: "Unknown / Not Tested", label: "Unknown / Not Tested" },
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
      className={`border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full ${className ?? ""}`}
    >
      {BLOOD_GROUPS.map((bg) => (
        <option key={bg.value} value={bg.value} disabled={bg.value === ""}>
          {bg.label}
        </option>
      ))}
    </select>
  );
}
