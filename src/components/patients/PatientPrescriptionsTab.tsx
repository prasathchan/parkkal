"use client";

import Link from "next/link";
import type { PatientPrescription } from "@/api/patients";

interface Props {
  prescriptions: PatientPrescription[];
}

export function PatientPrescriptionsTab({ prescriptions }: Props) {
  if (prescriptions.length === 0) {
    return <p className="text-center text-slate-400 text-sm py-6">No prescriptions recorded for this patient.</p>;
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((rx) => (
        <div key={rx.id} className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <Link href={`/dashboard/visits/${rx.visitId}?tab=prescriptions`} className="text-xs text-blue-600 hover:underline font-medium">
              View visit →
            </Link>
            <span className="text-sm font-medium text-slate-700">Dr. {rx.doctorName}</span>
            {rx.visitDate && (
              <span className="text-xs text-slate-400">
                {new Date(rx.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[400px]">
              {rx.medicines.length > 0 && (
                <div className="px-5 py-1.5 grid grid-cols-4 gap-2 bg-slate-50 border-t border-slate-100">
                  {["Drug", "Dosage", "Frequency", "Duration"].map((h) => (
                    <p key={h} className="text-xs text-slate-400 font-medium">{h}</p>
                  ))}
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {rx.medicines.map((med, i) => (
                  <div key={i} className="px-5 py-3 grid grid-cols-4 gap-2 text-sm">
                    <p className="font-medium text-slate-800">{med.name}</p>
                    <p className="text-slate-600">{med.dosage}</p>
                    <p className="text-slate-600">{med.frequency}</p>
                    <p className="text-slate-600">{med.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {rx.instructions && (
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50">
              <p className="text-xs text-amber-700"><span className="font-semibold">Instructions: </span>{rx.instructions}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
