"use client";

import Link from "next/link";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { STATUS_COLORS, type HistoryVisit } from "./types";

interface Props {
  patientName: string;
  history: HistoryVisit[];
}

export function VisitHistoryTab({ patientName, history }: Props) {
  return (
    <div>
      <p className="text-sm text-pk-text-muted mb-4">
        All visits for <span className="font-semibold text-pk-text-secondary">{patientName}</span>
      </p>
      {history.length === 0 ? (
        <p className="text-center text-pk-text-muted text-sm py-6">No other visits</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <Link
              key={h.id}
              href={`/dashboard/visits/${h.id}`}
              className="flex items-center justify-between p-3 border border-pk-border rounded-pk-sm hover:bg-pk-teal-50 hover:border-pk-teal-200 transition"
            >
              <div>
                <p className="text-sm font-mono text-pk-teal-700">{h.visitCode}</p>
                <p className="text-xs text-pk-text-muted">{h.visitDate} · {formatDoctorName(h.doctorName)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatCurrency(h.totalAmount)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status] || "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                  {h.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
