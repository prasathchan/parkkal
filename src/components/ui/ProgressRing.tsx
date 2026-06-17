"use client";

interface Props {
  /** 0–100 */
  percent: number;
  /** px — default 40 */
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({ percent, size = 40, strokeWidth = 4 }: Props) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (p / 100) * circ;

  // teal progress until done, green at 100%
  const fillColor = p >= 100 ? "#1a7f37" : p > 0 ? "#0B6E6E" : "transparent";
  const trackColor = p >= 100 ? "#e8f5ea" : "#D4EEEc";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
      aria-label={`${p}% collected`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {p > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.21}
        fontWeight="700"
        fill={fillColor || "#9ca3af"}
      >
        {p >= 100 ? "✓" : `${p}%`}
      </text>
    </svg>
  );
}
