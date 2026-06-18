"use client";

/**
 * VisitFilesTab — combines Attachments + Clinical Photos in one tab.
 * Phase 2-1: merges the two separate tabs to reduce tab count from 8 → 6.
 */

import { useState } from "react";
import { VisitAttachmentsTab } from "./VisitAttachmentsTab";
import { VisitPhotosTab } from "./VisitPhotosTab";
import type { Attachment, Treatment } from "./types";
import type { ClinicalPhoto } from "@/types";

interface Props {
  visitId: string;
  visitStatus: string;
  patientId: string;
  attachments: Attachment[];
  photos: ClinicalPhoto[];
  treatments: Treatment[];
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
}

export function VisitFilesTab({
  visitId, visitStatus, patientId,
  attachments, photos, treatments,
  onRefresh, onPageError,
}: Props) {
  const [section, setSection] = useState<"photos" | "attachments">("photos");

  return (
    <div className="space-y-0">
      {/* Section tabs */}
      <div className="flex gap-1 mb-5 border-b border-pk-border pb-0">
        <button
          type="button"
          onClick={() => setSection("photos")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            section === "photos"
              ? "border-pk-teal-600 text-pk-teal-600"
              : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"
          }`}
        >
          Photos
          {photos.length > 0 && (
            <span className="ml-1.5 text-xs bg-pk-teal-100 text-pk-teal-700 px-1.5 rounded-full">
              {photos.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSection("attachments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            section === "attachments"
              ? "border-pk-teal-600 text-pk-teal-600"
              : "border-transparent text-pk-text-muted hover:text-pk-text-secondary"
          }`}
        >
          Attachments
          {attachments.length > 0 && (
            <span className="ml-1.5 text-xs bg-pk-teal-100 text-pk-teal-700 px-1.5 rounded-full">
              {attachments.length}
            </span>
          )}
        </button>
      </div>

      {section === "photos" && (
        <VisitPhotosTab
          visitId={visitId}
          visitStatus={visitStatus}
          photos={photos}
          treatments={treatments}
          onRefresh={onRefresh}
          onPageError={onPageError}
        />
      )}
      {section === "attachments" && (
        <VisitAttachmentsTab
          visitId={visitId}
          visitStatus={visitStatus}
          attachments={attachments}
          patientId={patientId}
          onRefresh={onRefresh}
          onPageError={onPageError}
        />
      )}
    </div>
  );
}
