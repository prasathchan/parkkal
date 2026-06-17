"use client";

import { useState } from "react";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import type { ClinicalPhoto } from "@/types";

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  photos: ClinicalPhoto[];
}

export function TreatmentPhotosSection({ photos }: Props) {
  const [selectedBeforeId, setSelectedBeforeId] = useState<string | null>(null);
  const [selectedAfterId, setSelectedAfterId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: ClinicalPhoto[]; index: number } | null>(null);

  const beforePhotos  = photos.filter((p) => p.photoRole === "BEFORE").sort((a, b) => a.createdAt - b.createdAt);
  const afterPhotos   = photos.filter((p) => p.photoRole === "AFTER").sort((a, b) => b.createdAt - a.createdAt);
  const progressPhotos = photos.filter((p) => p.photoRole === "PROGRESS").sort((a, b) => a.createdAt - b.createdAt);

  const activeBefore = beforePhotos.find((p) => p.id === selectedBeforeId) ?? beforePhotos[0] ?? null;
  const activeAfter  = afterPhotos.find((p) => p.id === selectedAfterId)  ?? afterPhotos[0]  ?? null;
  const showSlider   = activeBefore !== null && activeAfter !== null;

  if (photos.length === 0) return null;

  return (
    <div className="bg-pk-surface rounded-pk-xl border border-pk-border p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pk-text">
          Clinical Photos
          <span className="ml-2 font-normal text-pk-text-muted">({photos.length})</span>
        </h2>
        {showSlider && (
          <span className="text-xs text-pk-text-muted">Drag the handle to compare</span>
        )}
      </div>

      {/* ── Comparison ── */}
      {showSlider ? (
        <div className="space-y-3">
          <BeforeAfterSlider
            beforeUrl={activeBefore.fileUrl}
            afterUrl={activeAfter.fileUrl}
            height={340}
          />

          {/* Thumb selectors — only shown when there are multiple before/afters */}
          {(beforePhotos.length > 1 || afterPhotos.length > 1) && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              {beforePhotos.length > 1 && (
                <div>
                  <p className="text-[10px] text-pk-text-muted font-semibold uppercase tracking-wide mb-1.5">
                    Select Before ({beforePhotos.length})
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {beforePhotos.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedBeforeId(p.id)}
                        title={fmt(p.createdAt)}
                        className={`flex-shrink-0 rounded border-2 overflow-hidden transition ${
                          activeBefore.id === p.id
                            ? "border-pk-teal-600"
                            : "border-transparent opacity-60 hover:opacity-100 hover:border-pk-border"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.fileUrl} alt="" className="w-14 h-10 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {afterPhotos.length > 1 && (
                <div>
                  <p className="text-[10px] text-pk-text-muted font-semibold uppercase tracking-wide mb-1.5">
                    Select After ({afterPhotos.length})
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {afterPhotos.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedAfterId(p.id)}
                        title={fmt(p.createdAt)}
                        className={`flex-shrink-0 rounded border-2 overflow-hidden transition ${
                          activeAfter.id === p.id
                            ? "border-pk-teal-600"
                            : "border-transparent opacity-60 hover:opacity-100 hover:border-pk-border"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.fileUrl} alt="" className="w-14 h-10 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* No slider — static side-by-side when only one side has photos */
        <div className="grid grid-cols-2 gap-4">
          {(["BEFORE", "AFTER"] as const).map((role) => {
            const photo = role === "BEFORE" ? activeBefore : activeAfter;
            const photos_ = role === "BEFORE" ? beforePhotos : afterPhotos;
            const labelColor =
              role === "BEFORE"
                ? "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border"
                : "bg-pk-success-fill text-pk-success-text border-pk-success-border";
            return (
              <div key={role} className="relative rounded-pk-lg overflow-hidden border border-pk-border bg-pk-surface-sunken">
                <span className={`absolute top-2 left-2 z-10 text-xs font-semibold px-2 py-0.5 rounded-full border ${labelColor}`}>
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </span>
                {photo ? (
                  <button
                    className="block w-full"
                    onClick={() => setLightbox({ photos: photos_, index: 0 })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.fileUrl}
                      alt={photo.originalName}
                      className="w-full h-48 object-cover hover:opacity-90 transition"
                    />
                  </button>
                ) : (
                  <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-pk-text-muted">
                    <svg className="w-8 h-8 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">No {role.toLowerCase()} photo yet</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Progress filmstrip ── */}
      {progressPhotos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-pk-text-muted uppercase tracking-wide mb-2">
            Progress — {progressPhotos.length} {progressPhotos.length === 1 ? "photo" : "photos"}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {progressPhotos.map((photo, i) => (
              <button
                key={photo.id}
                onClick={() => setLightbox({ photos: progressPhotos, index: i })}
                className="flex-shrink-0 group text-left"
              >
                <div className="relative rounded-pk-sm overflow-hidden border border-pk-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.fileUrl}
                    alt=""
                    className="w-24 h-20 object-cover group-hover:opacity-85 transition"
                  />
                </div>
                <p className="text-[10px] text-pk-text-muted text-center mt-1 w-24">{fmt(photo.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
