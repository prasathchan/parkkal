"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  beforeUrl: string;
  afterUrl: string;
  height?: number;
}

export function BeforeAfterSlider({ beforeUrl, afterUrl, height = 320 }: Props) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const calcPos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => calcPos(e.clientX);
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging, calcPos]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-pk-lg overflow-hidden select-none"
      style={{ height, cursor: "col-resize" }}
      onTouchMove={(e) => calcPos(e.touches[0].clientX)}
    >
      {/* Before — always visible as the base layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeUrl}
        alt="Before"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* After — clipped to reveal only the left portion */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt="After"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {/* Corner labels */}
      <span className="absolute top-3 left-3 z-10 text-[10px] font-bold text-white bg-black/55 px-2 py-0.5 rounded-full pointer-events-none tracking-widest">
        BEFORE
      </span>
      <span className="absolute top-3 right-3 z-10 text-[10px] font-bold text-white bg-black/55 px-2 py-0.5 rounded-full pointer-events-none tracking-widest">
        AFTER
      </span>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)] z-20 pointer-events-none"
        style={{ left: `${pos}%` }}
      />

      {/* Drag handle */}
      <button
        aria-label="Drag to compare before and after"
        className="absolute top-1/2 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-xl -translate-y-1/2 -translate-x-1/2 touch-none outline-none focus:ring-2 focus:ring-pk-teal-500"
        style={{ left: `${pos}%` }}
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={(e) => e.preventDefault()}
        onTouchMove={(e) => { e.preventDefault(); calcPos(e.touches[0].clientX); }}
      >
        <svg viewBox="0 0 20 20" className="w-5 h-5 text-pk-text-secondary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,4 2,10 6,16" />
          <polyline points="14,4 18,10 14,16" />
        </svg>
      </button>
    </div>
  );
}
