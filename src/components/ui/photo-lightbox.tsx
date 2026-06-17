"use client";

import { useState, useEffect } from "react";
import type { ClinicalPhoto } from "@/types";

const PHOTO_TYPES: Record<string, string> = {
  INTRA_ORAL: "Intra-Oral",
  EXTRA_ORAL: "Extra-Oral",
  FULL_FACE: "Full Face",
  PANORAMIC: "Panoramic",
  OTHER: "Other",
};

const ROLE_COLOR: Record<string, string> = {
  BEFORE:   "bg-pk-warning-fill text-pk-warning-text border-pk-warning-border",
  AFTER:    "bg-pk-success-fill text-pk-success-text border-pk-success-border",
  PROGRESS: "bg-pk-teal-50 text-pk-teal-700 border-pk-teal-200",
  UNTAGGED: "bg-pk-surface-raised text-pk-text-secondary border-pk-border",
};

const ROLE_LABEL: Record<string, string> = {
  BEFORE: "Before", AFTER: "After", PROGRESS: "Progress", UNTAGGED: "Untagged",
};

interface Props {
  photos: ClinicalPhoto[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const photo = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")  setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  if (!photo) return null;

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  const date = new Date(photo.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl leading-none z-10 transition"
      >
        &times;
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i - 1); }}
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-3 rounded-full hover:bg-white/10 transition z-10"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image + meta */}
      <div
        className="flex flex-col items-center gap-3 px-16 max-w-5xl w-full max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.fileUrl}
          alt={photo.originalName}
          className="max-h-[80vh] max-w-full object-contain rounded-lg"
        />
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLOR[photo.photoRole] ?? ROLE_COLOR.UNTAGGED}`}>
            {ROLE_LABEL[photo.photoRole] ?? photo.photoRole}
          </span>
          {PHOTO_TYPES[photo.photoType] && (
            <span className="text-xs text-white/50">{PHOTO_TYPES[photo.photoType]}</span>
          )}
          <span className="text-white/30">·</span>
          <span className="text-xs text-white/50">{date}</span>
          {photo.notes && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-xs text-white/50 italic">{photo.notes}</span>
            </>
          )}
          {photos.length > 1 && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-xs text-white/40">{index + 1} / {photos.length}</span>
            </>
          )}
        </div>

        {/* Filmstrip */}
        {photos.length > 1 && (
          <div className="flex gap-1.5 max-w-full overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIndex(i)}
                className={`flex-shrink-0 rounded overflow-hidden border-2 transition ${
                  i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.fileUrl} alt="" className="w-12 h-9 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i + 1); }}
          aria-label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-3 rounded-full hover:bg-white/10 transition z-10"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
