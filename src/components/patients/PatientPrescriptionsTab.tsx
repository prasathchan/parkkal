"use client";

import Link from "next/link";
import type { PatientPrescription } from "@/api/patients";

interface Props {
  prescriptions: PatientPrescription[];
}

export function PatientPrescriptionsTab({ prescriptions }: Props) {
  if (prescriptions.length === 0) {
    return <p className="text-center text-pk-text-muted text-sm py-6">No prescriptions recorded for this patient.</p>;
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((rx) => (
        <div key={rx.id} className="border border-pk-border rounded-pk-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-pk-surface-raised border-b border-pk-border">
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/visits/${rx.visitId}?tab=prescriptions`} className="text-xs text-pk-teal-600 hover:underline font-medium">
                View visit →
              </Link>
              <span className="text-sm font-medium text-pk-text-secondary">Dr. {rx.doctorName}</span>
              {rx.visitDate && (
                <span className="text-xs text-pk-text-muted">
                  {new Date(rx.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            <button
              onClick={() => window.open(`/dashboard/visits/${rx.visitId}/print`, "_blank")}
              aria-label="Print prescription"
              className="flex items-center gap-1 text-xs text-pk-text-muted hover:text-pk-text-secondary px-2 py-1 rounded hover:bg-pk-surface-sunken transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[400px]">
              {rx.medicines.length > 0 && (
                <div className="px-5 py-1.5 grid grid-cols-4 gap-2 bg-pk-surface-raised border-t border-pk-border">
                  {["Drug", "Dosage", "Frequency", "Duration"].map((h) => (
                    <p key={h} className="text-xs text-pk-text-muted font-medium">{h}</p>
                  ))}
                </div>
              )}
              <div className="divide-y divide-pk-border">
                {rx.medicines.map((med, i) => (
                  <div key={i} className="px-5 py-3 grid grid-cols-4 gap-2 text-sm">
                    <p className="font-medium text-pk-text">{med.name}</p>
                    <p className="text-pk-text-secondary">{med.dosage}</p>
                    <p className="text-pk-text-secondary">{med.frequency}</p>
                    <p className="text-pk-text-secondary">{med.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {rx.instructions && (
            <div className="px-5 py-3 border-t border-pk-border bg-pk-warning-fill">
              <p className="text-xs text-pk-warning-text"><span className="font-semibold">Instructions: </span>{rx.instructions}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
