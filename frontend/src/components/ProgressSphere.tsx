interface Props {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

export default function ProgressSphere({ percent, size = 90, strokeWidth = 7 }: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;
  const gap = circumference - dash;

  // Color based on progress
  const color = clamped === 100 ? '#10B981' : clamped >= 75 ? '#3B82F6' : clamped >= 40 ? '#F59E0B' : '#E2E8F0';
  const textColor = clamped === 100 ? '#065F46' : clamped >= 75 ? '#1D4ED8' : clamped >= 40 ? '#92400E' : '#94A3B8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} className="sphere-svg">
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
        {/* Progress arc */}
        {clamped > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
          />
        )}
        {/* Center text */}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: size < 60 ? 13 : 16, fill: textColor }}>
          {clamped}%
        </text>
      </svg>
    </div>
  );
}
