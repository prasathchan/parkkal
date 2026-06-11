"use client";

import { formatCurrency, formatDate, formatDoctorName } from "@/lib/utils";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";

type TabType = "visits" | "appointments" | "treatments" | "invoices";

interface Props {
  tab: TabType;
  tabData: unknown[];
}

export function PatientTabList({ tab, tabData }: Props) {
  if (tabData.length === 0) {
    return <p className="text-center text-slate-400 text-sm py-6">No {tab} found for this patient.</p>;
  }

  return (
    <div className="space-y-3">
      {tabData.map((item) => {
        const row = item as Record<string, unknown>;
        if (tab === "visits") {
          const due = (row.totalAmount as number) - (row.paidAmount as number);
          return (
            <a key={row.id as string} href={`/dashboard/visits/${row.id}`} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-1 transition">
              <div>
                <p className="text-sm font-mono font-medium text-blue-700">{row.visitCode as string}</p>
                <p className="text-xs text-slate-500">{row.visitDate as string} · {formatDoctorName(row.doctorName as string)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.totalAmount as number)}</p>
                {due > 0 && <p className="text-xs text-red-500">Due {formatCurrency(due)}</p>}
                <Badge variant={getStatusBadgeVariant(row.status as string)}>{row.status as string}</Badge>
              </div>
            </a>
          );
        }
        if (tab === "appointments") {
          return (
            <div key={row.id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium">{row.appointmentDate as string} at {row.appointmentTime as string}</p>
                <p className="text-xs text-slate-500">{row.type as string}</p>
              </div>
              <Badge variant={getStatusBadgeVariant(row.status as string)}>{row.status as string}</Badge>
            </div>
          );
        }
        if (tab === "treatments") {
          return (
            <div key={row.id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium">{(row.itemName || row.description) as string}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {(row.category as string) && <span className="text-xs text-slate-400">{row.category as string}</span>}
                  {((row.toothNumber || row.toothNumbers) as string) && <span className="text-xs text-slate-400">Tooth: {(row.toothNumber || row.toothNumbers) as string}</span>}
                  {(row.visitDate as string) && <span className="text-xs text-slate-400">{row.visitDate as string}</span>}
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency((row.amount ?? row.cost ?? 0) as number)}</p>
            </div>
          );
        }
        if (tab === "invoices") {
          return (
            <div key={row.id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium">Invoice · {formatDate(row.createdAt as number)}</p>
                <p className="text-xs text-slate-500">Paid: {formatCurrency(row.paidAmount as number)} / {formatCurrency(row.totalAmount as number)}</p>
              </div>
              <Badge variant={getStatusBadgeVariant(row.status as string)}>{row.status as string}</Badge>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
