"use client";

import { useState, useRef } from "react";
import { visitsApi, ApiError } from "@/api";
import { formatBytes } from "./types";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { ClinicalPhoto, PhotoRole, PhotoType } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PHOTO_ROLES: { value: PhotoRole; label: string; color: string }[] = [
  { value: "BEFORE",   label: "Before",   color: "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border" },
  { value: "AFTER",    label: "After",    color: "bg-pk-success-fill text-pk-success-text border-pk-success-border" },
  { value: "PROGRESS", label: "Progress", color: "bg-pk-teal-50 text-pk-teal-700 border-pk-teal-200" },
  { value: "UNTAGGED", label: "Untagged", color: "bg-pk-surface-raised text-pk-text-secondary border-pk-border" },
];

const PHOTO_TYPES: { value: PhotoType; label: string }[] = [
  { value: "INTRA_ORAL",  label: "Intra-Oral" },
  { value: "EXTRA_ORAL",  label: "Extra-Oral" },
  { value: "FULL_FACE",   label: "Full Face" },
  { value: "PANORAMIC",   label: "Panoramic" },
  { value: "OTHER",       label: "Other" },
];

const ROLE_ORDER: PhotoRole[] = ["BEFORE", "AFTER", "PROGRESS", "UNTAGGED"];

type FilterKey = "ALL" | PhotoRole;

function roleMeta(role: PhotoRole) {
  return PHOTO_ROLES.find((r) => r.value === role) ?? PHOTO_ROLES[3];
}

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Thumb selector strip ─────────────────────────────────────────────────────

function ThumbStrip({
  label,
  photos,
  activeId,
  onSelect,
}: {
  label: string;
  photos: ClinicalPhoto[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (photos.length <= 1) return null;
  const effectiveId = activeId ?? photos[0]?.id ?? null;
  return (
    <div>
      <p className="text-[10px] text-pk-text-muted font-semibold uppercase tracking-wide mb-1.5">
        {label} — {photos.length} photos
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {photos.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            title={fmt(p.createdAt)}
            className={`flex-shrink-0 rounded border-2 overflow-hidden transition ${
              effectiveId === p.id
                ? "border-pk-teal-600"
                : "border-transparent opacity-55 hover:opacity-90 hover:border-pk-border"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.fileUrl} alt="" className="w-16 h-11 object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Photo card ───────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  canDelete,
  onOpen,
  onDelete,
}: {
  photo: ClinicalPhoto;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const meta = roleMeta(photo.photoRole);
  const typeMeta = PHOTO_TYPES.find((t) => t.value === photo.photoType);
  return (
    <div className="relative rounded-pk-lg border border-pk-border bg-pk-surface overflow-hidden group">
      <button onClick={onOpen} className="block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.fileUrl}
          alt={photo.originalName}
          className="w-full h-36 object-cover hover:opacity-90 transition"
        />
      </button>
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.color}`}>
            {meta.label}
          </span>
          {typeMeta && (
            <span className="text-[10px] text-pk-text-muted">{typeMeta.label}</span>
          )}
        </div>
        <p className="text-[10px] text-pk-text-muted mt-1">{fmt(photo.createdAt)}</p>
        {photo.notes && (
          <p className="text-[10px] text-pk-text-muted truncate">{photo.notes}</p>
        )}
        <p className="text-[10px] text-pk-text-muted">{formatBytes(photo.fileSize)}</p>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          aria-label="Delete photo"
          className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white text-sm hover:bg-red-600 transition"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visitId: string;
  visitStatus: string;
  photos: ClinicalPhoto[];
  treatments: { id: string; description: string }[];
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
}

// ─── Tab component ────────────────────────────────────────────────────────────

export function VisitPhotosTab({
  visitId,
  visitStatus,
  photos,
  treatments,
  onRefresh,
  onPageError,
}: Props) {
  // Upload state
  const [photoRole,    setPhotoRole]    = useState<PhotoRole>("BEFORE");
  const [photoType,    setPhotoType]    = useState<PhotoType>("INTRA_ORAL");
  const [treatmentId,  setTreatmentId]  = useState("");
  const [notes,        setNotes]        = useState("");
  const [uploadError,  setUploadError]  = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  // Gallery state
  const [filter,          setFilter]          = useState<FilterKey>("ALL");
  const [selectedBeforeId, setSelectedBeforeId] = useState<string | null>(null);
  const [selectedAfterId,  setSelectedAfterId]  = useState<string | null>(null);

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ photos: ClinicalPhoto[]; index: number } | null>(null);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = visitStatus !== "CANCELLED";

  // ─── Upload ──────────────────────────────────────────────────────────────────

  async function doUpload(file: File) {
    setUploadError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("photoRole", photoRole);
    fd.append("photoType", photoType);
    if (treatmentId) fd.append("treatmentId", treatmentId);
    if (notes)       fd.append("notes", notes);
    try {
      await visitsApi.photos.add(visitId, fd);
      await onRefresh();
      setNotes("");
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) doUpload(file);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async function doDeletePhoto(photoId: string) {
    try {
      await visitsApi.photos.delete(visitId, photoId);
      await onRefresh();
    } catch (err) {
      onPageError(err instanceof ApiError ? err.message : "Failed to delete photo");
    }
  }

  // ─── Grouping & filtering ─────────────────────────────────────────────────────

  const grouped = ROLE_ORDER.reduce<Record<PhotoRole, ClinicalPhoto[]>>(
    (acc, role) => {
      acc[role] = photos
        .filter((p) => p.photoRole === role)
        .sort((a, b) => a.createdAt - b.createdAt);
      return acc;
    },
    { BEFORE: [], AFTER: [], PROGRESS: [], UNTAGGED: [] },
  );

  const filteredPhotos =
    filter === "ALL"
      ? [...photos].sort((a, b) => a.createdAt - b.createdAt)
      : grouped[filter as PhotoRole];

  const beforePhotos = grouped.BEFORE;
  const afterPhotos  = [...grouped.AFTER].reverse(); // newest-first for comparison
  const activeBefore = beforePhotos.find((p) => p.id === selectedBeforeId) ?? beforePhotos[0] ?? null;
  const activeAfter  = afterPhotos.find((p) => p.id === selectedAfterId)   ?? afterPhotos[0]  ?? null;
  const showComparison = beforePhotos.length > 0 && afterPhotos.length > 0;

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "ALL",      label: "All",      count: photos.length },
    { key: "BEFORE",   label: "Before",   count: grouped.BEFORE.length },
    { key: "AFTER",    label: "After",    count: grouped.AFTER.length },
    { key: "PROGRESS", label: "Progress", count: grouped.PROGRESS.length },
    { key: "UNTAGGED", label: "Untagged", count: grouped.UNTAGGED.length },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Upload zone ── */}
      {canEdit && (
        <div
          className={`border-2 border-dashed rounded-pk-lg transition-colors ${
            draggingOver ? "border-pk-teal-500 bg-pk-teal-50" : "border-pk-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
        >
          {draggingOver ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <svg className="w-10 h-10 text-pk-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm font-medium text-pk-teal-700">Drop photo here</p>
            </div>
          ) : (
            <div className="p-5">
              <p className="text-xs font-semibold text-pk-text-muted uppercase tracking-wide mb-4">
                Upload Clinical Photo
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-pk-text-muted mb-1">Photo Role</label>
                  <select
                    value={photoRole}
                    onChange={(e) => setPhotoRole(e.target.value as PhotoRole)}
                    className="w-full text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500 bg-pk-surface"
                  >
                    {PHOTO_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-pk-text-muted mb-1">View Type</label>
                  <select
                    value={photoType}
                    onChange={(e) => setPhotoType(e.target.value as PhotoType)}
                    className="w-full text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500 bg-pk-surface"
                  >
                    {PHOTO_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {treatments.length > 0 && (
                  <div>
                    <label className="block text-xs text-pk-text-muted mb-1">Link to Treatment</label>
                    <select
                      value={treatmentId}
                      onChange={(e) => setTreatmentId(e.target.value)}
                      className="w-full text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500 bg-pk-surface"
                    >
                      <option value="">— None —</option>
                      {treatments.map((t) => (
                        <option key={t.id} value={t.id}>{t.description}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-pk-text-muted mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Day 1 of root canal"
                    className="w-full text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500 bg-pk-surface"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`px-4 py-2 rounded-pk-sm text-sm font-medium transition ${
                    uploading
                      ? "bg-pk-teal-400 text-white opacity-70 cursor-not-allowed"
                      : "bg-pk-teal-600 text-white hover:bg-pk-teal-700"
                  }`}
                >
                  {uploading ? "Uploading…" : "Select Photo"}
                </button>
                <span className="text-xs text-pk-text-muted">
                  or drag &amp; drop · JPEG · PNG · WebP · HEIC · up to 20 MB
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {uploadError && (
                <p className="text-pk-danger-text text-xs mt-2">{uploadError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-pk-text-muted gap-2">
          <svg className="w-14 h-14 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium">No clinical photos yet</p>
          {canEdit && (
            <p className="text-xs">Upload a Before photo to start tracking this patient&apos;s progress</p>
          )}
        </div>
      )}

      {/* ── Photos present ── */}
      {photos.length > 0 && (
        <>
          {/* Before/After comparison slider */}
          {showComparison && (
            <div className="bg-pk-surface-raised rounded-pk-xl border border-pk-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-pk-text">Before / After Comparison</p>
                <span className="text-xs text-pk-text-muted">Drag the handle to compare</span>
              </div>

              <BeforeAfterSlider
                beforeUrl={activeBefore!.fileUrl}
                afterUrl={activeAfter!.fileUrl}
                height={340}
              />

              {/* Thumb selectors */}
              {(beforePhotos.length > 1 || afterPhotos.length > 1) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <ThumbStrip
                    label="Before"
                    photos={beforePhotos}
                    activeId={selectedBeforeId}
                    onSelect={setSelectedBeforeId}
                  />
                  <ThumbStrip
                    label="After"
                    photos={afterPhotos}
                    activeId={selectedAfterId}
                    onSelect={setSelectedAfterId}
                  />
                </div>
              )}
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 border-b border-pk-border overflow-x-auto">
            {filterTabs
              .filter((t) => t.count > 0 || t.key === "ALL")
              .map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    filter === tab.key
                      ? "border-pk-teal-600 text-pk-teal-600"
                      : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        filter === tab.key
                          ? "bg-pk-teal-100 text-pk-teal-700"
                          : "bg-pk-surface-raised text-pk-text-muted"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
          </div>

          {/* Gallery grid */}
          {filteredPhotos.length === 0 ? (
            <p className="text-center text-pk-text-muted text-sm py-6">
              No {filter === "ALL" ? "" : filter.toLowerCase() + " "}photos
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredPhotos.map((photo, i) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  canDelete={canEdit}
                  onOpen={() => setLightbox({ photos: filteredPhotos, index: i })}
                  onDelete={() => setConfirmDeletePhotoId(photo.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {confirmDeletePhotoId && (
        <ConfirmModal
          title="Delete photo?"
          message="This photo will be permanently removed."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => { const id = confirmDeletePhotoId; setConfirmDeletePhotoId(null); doDeletePhoto(id); }}
          onCancel={() => setConfirmDeletePhotoId(null)}
        />
      )}
    </div>
  );
}
