import { useState, useMemo } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Sunset,
  Sunrise,
  ChevronDown,
} from 'lucide-react';

function renderHourlyIcon(condition, iconCode, rainPop) {
  const isNight = iconCode && iconCode.includes('n');

  if (condition === 'storm') {
    return <CloudLightning size={20} className="text-amber-400" style={{ color: '#fbbf24' }} />;
  }
  if (condition === 'rain') {
    return <CloudRain size={20} className="text-sky-400" style={{ color: '#38bdf8' }} />;
  }
  if (condition === 'snow') {
    return <Snowflake size={20} className="text-blue-200" style={{ color: '#bae6fd' }} />;
  }
  if (condition === 'cloudy') {
    return <Cloud size={20} className="text-slate-300" style={{ color: '#cbd5e1' }} />;
  }
  // Clear
  if (isNight) {
    return <Moon size={20} className="text-amber-200" style={{ color: '#fef08a' }} />;
  }
  return <Sun size={20} className="text-amber-400" style={{ color: '#f59e0b' }} />;
}

export default function HourlyTempSpline({
  hourly = [],
  sunriseTime = '',
  sunsetTime = '',
  currentTemp = 30,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Synthesize points with sunrise/sunset integration if available
  const timelinePoints = useMemo(() => {
    if (!hourly || hourly.length === 0) return [];

    const list = [...hourly];

    // Check if sunset or sunrise can be placed between hourly slots
    if (sunsetTime && !list.some((p) => p.isEvent)) {
      list.splice(1, 0, {
        time: sunsetTime,
        temp: list[0]?.temp ?? currentTemp,
        isEvent: true,
        eventType: 'sunset',
        label: 'Sunset',
      });
    }

    return list;
  }, [hourly, sunsetTime, currentTemp]);

  if (timelinePoints.length === 0) return null;

  // Chart dimensions
  const pointWidth = 74;
  const chartHeight = 110;
  const paddingY = 28;
  const svgWidth = Math.max(timelinePoints.length * pointWidth, 420);

  // Min and max temps for spline scale
  const temps = timelinePoints.map((p) => p.temp);
  const minT = Math.min(...temps) - 2;
  const maxT = Math.max(...temps) + 2;
  const range = maxT - minT || 1;

  // Compute (x, y) coordinates for each point
  const coords = timelinePoints.map((p, i) => {
    const x = i * pointWidth + pointWidth / 2;
    const y = paddingY + (1 - (p.temp - minT) / range) * (chartHeight - paddingY * 2);
    return { ...p, x, y };
  });

  // Construct smooth Catmull-Rom / Bézier spline path
  const buildSplinePath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const splinePath = buildSplinePath(coords);
  const areaPath = `${splinePath} L ${coords[coords.length - 1].x} ${chartHeight} L ${coords[0].x} ${chartHeight} Z`;

  const activePoint = coords[selectedIndex] || coords[0];

  return (
    <div className="hourly-spline-container">
      {/* Scrollable hourly track */}
      <div className="hourly-scroll-track">
        <svg
          className="hourly-spline-svg"
          width={svgWidth}
          height={chartHeight}
          viewBox={`0 0 ${svgWidth} ${chartHeight}`}
        >
          <defs>
            {/* Stroke gradient: yellow/orange -> yellow-green/emerald */}
            <linearGradient id="splineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="35%" stopColor="#fbbf24" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            {/* Area fill gradient */}
            <linearGradient id="splineArea" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(245, 158, 11, 0.22)" />
              <stop offset="100%" stopColor="rgba(245, 158, 11, 0.00)" />
            </linearGradient>
          </defs>

          {/* Dotted horizontal guideline through active point */}
          <line
            x1="0"
            y1={activePoint.y}
            x2={svgWidth}
            y2={activePoint.y}
            stroke="rgba(255, 255, 255, 0.28)"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Vertical dashed indicator line from active point to bottom */}
          <line
            x1={activePoint.x}
            y1={activePoint.y}
            x2={activePoint.x}
            y2={chartHeight + 60}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeDasharray="3 3"
            strokeWidth="1.2"
          />

          {/* Subtle Area fill under spline */}
          <path d={areaPath} fill="url(#splineArea)" />

          {/* Glowing spline curve */}
          <path
            d={splinePath}
            fill="none"
            stroke="url(#splineGradient)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Node points on the spline */}
          {coords.map((pt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <g
                key={idx}
                className="spline-node-group"
                onClick={() => setSelectedIndex(idx)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected ? (
                  /* Prominent active temperature badge circle */
                  <g>
                    {/* Outer glow ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="16"
                      fill="rgba(249, 115, 22, 0.3)"
                      className="animate-pulse"
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="#ffffff"
                      stroke="#f97316"
                      strokeWidth="3"
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 4}
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                    >
                      {pt.temp}°
                    </text>
                  </g>
                ) : (
                  /* Secondary node dots */
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill="rgba(255, 255, 255, 0.8)"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Labels and weather icons row underneath */}
        <div className="hourly-items-row" style={{ width: svgWidth }}>
          {coords.map((pt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={idx}
                className={`hourly-item ${isSelected ? 'active' : ''}`}
                style={{ width: pointWidth }}
                onClick={() => setSelectedIndex(idx)}
              >
                {pt.isEvent ? (
                  /* Sunset / Sunrise event */
                  <div className="hourly-event-badge">
                    <Sunset size={20} style={{ color: '#fbbf24' }} />
                    <span className="hourly-event-time">{pt.time}</span>
                  </div>
                ) : (
                  /* Weather hour item */
                  <div className="hourly-data-badge">
                    <div className="hourly-icon-wrap">
                      {renderHourlyIcon(pt.condition, pt.icon, pt.rainPop)}
                      {pt.rainPop > 0 && (
                        <span className="hourly-rain-pop">{pt.rainPop}%</span>
                      )}
                    </div>
                    <span className="hourly-time">{pt.time}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Down chevron indicator */}
      <div className="hourly-expand-indicator">
        <ChevronDown size={18} style={{ opacity: 0.55 }} />
      </div>
    </div>
  );
}
