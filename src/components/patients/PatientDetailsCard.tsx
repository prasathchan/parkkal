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
  dataConsentAt?: number | null;
  createdAt: number;
}

interface Props {
  patient: Patient;
  onErase: () => void;
  onWithdrawConsent?: () => void;
  isAdmin?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function PatientDetailsCard({ patient, onErase, onWithdrawConsent, isAdmin = false, collapsed = false, onToggleCollapse }: Props) {
  const [showEraseModal, setShowEraseModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
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
            <button type="button" onClick={onToggleCollapse} className="flex items-center gap-2">
              <svg className={`w-4 h-4 text-pk-text-muted transition-transform ${collapsed ? "" : "rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <CardTitle>Patient Details</CardTitle>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-pk-teal-100 text-pk-teal-700 px-2.5 py-1 rounded-full">
                {patient.patientCode}
              </span>
              <Link
                href={`/dashboard/patients/${patient.id}/edit`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-pk-text-secondary border border-pk-border hover:bg-pk-surface-raised px-2.5 py-1 rounded-pk-sm transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </Link>
            </div>
          </div>
        </CardHeader>
        {!collapsed && <CardContent>
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
              <p className="text-sm text-pk-text-secondary bg-pk-surface-raised rounded-pk-sm p-3">{patient.medicalHistory}</p>
            </div>
          )}
          {/* DPDP data consent status */}
          <div className="mt-4 pt-4 border-t border-pk-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-pk-text mb-0.5">Data Processing Consent</p>
                {patient.dataConsentAt ? (
                  <p className="text-xs text-pk-text-muted">
                    <span className="inline-flex items-center gap-1 text-pk-success-text font-medium">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Consent given
                    </span>
                    {" "}on {formatDate(patient.dataConsentAt)}
                  </p>
                ) : (
                  <p className="text-xs text-pk-warning-text font-medium">No consent on record</p>
                )}
              </div>
              {isAdmin && patient.dataConsentAt && onWithdrawConsent && (
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="text-xs border border-pk-warning-border text-pk-warning-text px-3 py-1.5 rounded-pk-sm hover:bg-pk-warning-fill transition font-medium shrink-0 ml-4"
                >
                  Withdraw Consent
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-pk-danger-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-pk-danger-text">Erase Patient Data</p>
                <p className="text-xs text-pk-text-muted mt-0.5">Permanently delete all records for this patient (DPDP Act right to erasure). This cannot be undone.</p>
              </div>
              <button
                onClick={() => { setShowEraseModal(true); setConfirmText(""); setError(""); }}
                className="text-xs border border-pk-danger-border text-pk-danger-text px-3 py-1.5 rounded-pk-sm hover:bg-pk-danger-fill transition font-medium shrink-0 ml-4"
              >
                Erase Data
              </button>
            </div>
          </div>
        </CardContent>}
      </Card>

      {showEraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-pk-surface rounded-pk-xl border border-pk-danger-border shadow-pk-e3 max-w-md w-full p-6">
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
              className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-pk-danger"
            />
            {error && <p className="text-xs text-pk-danger-text mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleErase}
                disabled={confirmText !== "ERASE" || loading}
                className="flex-1 bg-pk-danger text-white rounded-pk-lg py-2 text-sm font-semibold hover:bg-pk-danger transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Erasing…" : "Permanently Erase"}
              </button>
              <button
                onClick={() => setShowEraseModal(false)}
                className="flex-1 border border-pk-border text-pk-text-secondary rounded-pk-lg py-2 text-sm font-medium hover:bg-pk-surface-raised transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-pk-surface rounded-pk-xl border border-pk-warning-border shadow-pk-e3 max-w-md w-full p-6">
            <h2 className="text-base font-bold text-pk-warning-text mb-1">Withdraw Data Processing Consent</h2>
            <p className="text-sm text-pk-text-secondary mb-4">
              Under the Digital Personal Data Protection Act 2023 (Article 13), <strong>{patient.name}</strong> has
              the right to withdraw consent at any time. This will clear the consent record. The patient&apos;s clinical
              data will remain until erased separately. This action is recorded in the audit log.
            </p>
            {error && <p className="text-xs text-pk-danger-text mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  try {
                    await onWithdrawConsent?.();
                    setShowWithdrawModal(false);
                  } catch {
                    setError("Failed to withdraw consent. Please try again.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 bg-pk-warning text-white rounded-pk-lg py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Processing…" : "Withdraw Consent"}
              </button>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 border border-pk-border text-pk-text-secondary rounded-pk-lg py-2 text-sm font-medium hover:bg-pk-surface-raised transition"
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
