import { motion } from 'framer-motion';

/**
 * RiskGauge Component
 * Renders a compact speedometer-style gauge visualization for Weather Risk Assessment (0–100).
 * Color mapped: GREEN (Low), YELLOW (Moderate), ORANGE (High), RED (Severe).
 */
export default function RiskGauge({ score = 25, label = 'Risk Assessment', level = 'Low', imdColor = 'GREEN', compact = true }) {
  const validScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const needleAngle = -90 + (validScore / 100) * 180;

  const colorMap = {
    GREEN: { stroke: '#22c55e', text: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' },
    YELLOW: { stroke: '#eab308', text: '#facc15', bg: 'rgba(234, 179, 8, 0.15)' },
    ORANGE: { stroke: '#f97316', text: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)' },
    RED: { stroke: '#ef4444', text: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' },
  };

  const activeColor = colorMap[imdColor?.toUpperCase()] || colorMap.GREEN;

  const svgWidth = compact ? 150 : 200;
  const svgHeight = compact ? 82 : 110;
  const cx = svgWidth / 2;
  const cy = svgHeight - 5;
  const r = compact ? 60 : 80;

  // Arc path string calculation for semicircle
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div
      className="risk-gauge-card"
      style={{
        background: 'rgba(17, 24, 39, 0.75)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${activeColor.stroke}`,
        borderRadius: 14,
        padding: compact ? '10px 14px' : '14px 18px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 10,
            background: activeColor.bg,
            color: activeColor.text,
            border: `1px solid ${activeColor.stroke}`,
          }}
        >
          IMD {imdColor || level}
        </span>
      </div>

      {/* Speedometer SVG Gauge */}
      <div style={{ position: 'relative', width: svgWidth, height: svgHeight, margin: '2px auto 0' }}>
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <defs>
            <linearGradient id="gaugeGradientCompact" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="35%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Background Arc */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={compact ? "11" : "15"}
            strokeLinecap="round"
          />

          {/* Colored Gradient Arc */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#gaugeGradientCompact)"
            strokeWidth={compact ? "11" : "15"}
            strokeLinecap="round"
          />

          {/* Center Hub */}
          <circle cx={cx} cy={cy} r={compact ? "6" : "9"} fill="#1e293b" stroke="#64748b" strokeWidth="2" />
        </svg>

        {/* Animated Needle */}
        <motion.div
          initial={{ rotate: -90 }}
          animate={{ rotate: needleAngle }}
          transition={{ type: 'spring', stiffness: 60, damping: 15 }}
          style={{
            position: 'absolute',
            bottom: 5,
            left: cx - 2,
            width: 4,
            height: compact ? 50 : 70,
            background: activeColor.text,
            borderRadius: 2,
            transformOrigin: 'bottom center',
            boxShadow: `0 0 8px ${activeColor.stroke}`,
          }}
        />
      </div>

      {/* Score & Legend */}
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
          {validScore} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>/ 100</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: activeColor.text, marginTop: 2 }}>
          {level.toUpperCase()} RISK
        </div>
      </div>
    </div>
  );
}

