"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { parseAddress, formatAddressDisplay } from "@/lib/address";
import { formatDate, calculateAge } from "@/lib/utils";

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  medicalHistory?: string | null;
  createdAt: number;
}

interface Props {
  patient: Patient;
  onErase: () => void;
}

export function PatientDetailsCard({ patient, onErase }: Props) {
  const [showEraseModal, setShowEraseModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleErase() {
    if (confirmText !== "ERASE") return;
    setLoading(true);
    setError("");
    try {
      await onErase();
    } catch {
      setError("Failed to erase patient data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Patient Details</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-pk-teal-100 text-pk-teal-700 px-2.5 py-1 rounded-full">
                {patient.patientCode}
              </span>
              <Link
                href={`/dashboard/patients/${patient.id}/edit`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-pk-text-secondary border border-pk-border hover:bg-pk-surface-raised px-2.5 py-1 rounded-lg transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-pk-text-muted text-xs mb-0.5">Phone</p>
              <p className="font-medium">{patient.phone}</p>
            </div>
            {patient.email && (
              <div>
                <p className="text-pk-text-muted text-xs mb-0.5">Email</p>
                <p className="font-medium">{patient.email}</p>
              </div>
            )}
            {patient.dateOfBirth && (
              <div>
                <p className="text-pk-text-muted text-xs mb-0.5">Age</p>
                <p className="font-medium">{calculateAge(patient.dateOfBirth)} yrs ({patient.dateOfBirth})</p>
              </div>
            )}
            {patient.gender && (
              <div>
                <p className="text-pk-text-muted text-xs mb-0.5">Gender</p>
                <p className="font-medium">{patient.gender}</p>
              </div>
            )}
            {patient.bloodGroup && (
              <div>
                <p className="text-pk-text-muted text-xs mb-0.5">Blood Group</p>
                <p className="font-medium text-pk-danger-text">{patient.bloodGroup}</p>
              </div>
            )}
            <div>
              <p className="text-pk-text-muted text-xs mb-0.5">Registered</p>
              <p className="font-medium">{formatDate(patient.createdAt)}</p>
            </div>
          </div>
          {patient.address && (
            <div className="mt-4 pt-4 border-t border-pk-border">
              <p className="text-pk-text-muted text-xs mb-0.5">Address</p>
              <p className="text-sm">{formatAddressDisplay(parseAddress(patient.address))}</p>
            </div>
          )}
          {patient.medicalHistory && (
            <div className="mt-3">
              <p className="text-pk-text-muted text-xs mb-0.5">Medical History</p>
              <p className="text-sm text-pk-text-secondary bg-pk-surface-raised rounded-lg p-3">{patient.medicalHistory}</p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-pk-danger-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-pk-danger-text">Erase Patient Data</p>
                <p className="text-xs text-pk-text-muted mt-0.5">Permanently delete all records for this patient (DPDP Act right to erasure). This cannot be undone.</p>
              </div>
              <button
                onClick={() => { setShowEraseModal(true); setConfirmText(""); setError(""); }}
                className="text-xs border border-pk-danger-border text-pk-danger-text px-3 py-1.5 rounded-lg hover:bg-pk-danger-fill transition font-medium shrink-0 ml-4"
              >
                Erase Data
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showEraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-pk-danger-border shadow-xl max-w-md w-full p-6">
            <h2 className="text-base font-bold text-pk-danger-text mb-1">Permanently Erase Patient Data</h2>
            <p className="text-sm text-pk-text-secondary mb-4">
              This will permanently delete <strong>{patient.name}</strong> and all associated visits, prescriptions,
              invoices, appointments, and records. This action is irreversible and will be recorded in the audit log.
            </p>
            <p className="text-xs text-pk-text-muted mb-2">Type <strong>ERASE</strong> to confirm:</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ERASE"
              className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-pk-danger"
            />
            {error && <p className="text-xs text-pk-danger-text mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleErase}
                disabled={confirmText !== "ERASE" || loading}
                className="flex-1 bg-pk-danger text-white rounded-xl py-2 text-sm font-semibold hover:bg-pk-danger transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Erasing…" : "Permanently Erase"}
              </button>
              <button
                onClick={() => setShowEraseModal(false)}
                className="flex-1 border border-pk-border text-pk-text-secondary rounded-xl py-2 text-sm font-medium hover:bg-pk-surface-raised transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
