"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  content: string;
  /** Position relative to the trigger icon. Default "top". */
  position?: "top" | "bottom" | "left" | "right";
  /** Max width in px. Default 260. */
  maxWidth?: number;
}

/**
 * A small (i) icon that shows a plain-text tooltip on hover/focus.
 * Keyboard accessible: appears on focus, dismisses on blur/Escape.
 */
export function InfoTooltip({ content, position = "top", maxWidth = 260 }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setVisible(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  const positionClass: Record<string, string> = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span ref={ref} className="relative inline-flex items-center" style={{ verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="w-4 h-4 rounded-full bg-pk-teal-100 text-pk-teal-700 text-[10px] font-bold flex items-center justify-center hover:bg-pk-teal-200 transition focus:outline-none focus:ring-2 focus:ring-pk-teal-500 shrink-0"
      >
        i
      </button>
      {visible && (
        <span
          role="tooltip"
          style={{ maxWidth, zIndex: 60 }}
          className={`absolute ${positionClass[position]} pointer-events-none bg-pk-surface-sunken border border-pk-border text-pk-text-secondary text-xs rounded-pk-sm px-2.5 py-1.5 shadow-pk-e2 w-max`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
