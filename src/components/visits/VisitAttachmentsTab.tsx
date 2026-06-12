"use client";

import { useState } from "react";
import { formatBytes, type Attachment } from "./types";
import { visitsApi, ApiError } from "@/api";

interface Props {
  visitId: string;
  visitStatus: string;
  attachments: Attachment[];
  patientId: string;
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
}

export function VisitAttachmentsTab({ visitId, visitStatus, attachments, patientId, onRefresh, onPageError }: Props) {
  const [fileType, setFileType] = useState("OTHER");
  const [uploadError, setUploadError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("fileType", fileType);
    fd.append("patientId", patientId);
    try {
      await visitsApi.attachments.add(visitId, fd);
      await onRefresh();
      e.target.value = "";
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    }
  }

  async function handleDeleteAttachment(attId: string) {
    if (!confirm("Delete this attachment?")) return;
    try {
      await visitsApi.attachments.delete(visitId, attId);
      await onRefresh();
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to delete attachment");
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      {visitStatus !== "CANCELLED" && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-slate-500 mb-3">Click to upload or drag &amp; drop files</p>
          <div className="flex items-center justify-center gap-3">
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="XRAY">X-Ray</option>
              <option value="PRESCRIPTION">Prescription</option>
              <option value="DOCTOR_NOTE">Doctor Note</option>
              <option value="LAB_REPORT">Lab Report</option>
              <option value="OTHER">Other</option>
            </select>
            <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Browse File
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          {uploadError && <p className="text-red-500 text-xs mt-2">{uploadError}</p>}
        </div>
      )}

      {/* Attachments Grid */}
      {attachments.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-4">No attachments yet</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {attachments.map((att) => (
            <div key={att.id} className="border border-slate-200 rounded-xl p-3 text-center relative group">
              {att.mimeType.startsWith("image/") ? (
                <a href={att.fileUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.fileUrl} alt={att.originalName} className="w-full h-24 object-cover rounded-lg mb-2" />
                </a>
              ) : (
                <div className="w-full h-24 bg-slate-100 rounded-lg flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <p className="text-xs font-medium text-slate-700 truncate">{att.originalName}</p>
              <p className="text-xs text-slate-400">{att.fileType} · {formatBytes(att.fileSize)}</p>
              {visitStatus !== "CANCELLED" && (
                <button
                  onClick={() => handleDeleteAttachment(att.id)}
                  aria-label={`Delete attachment ${att.originalName}`}
                  className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full text-xs hover:bg-red-200 transition"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
