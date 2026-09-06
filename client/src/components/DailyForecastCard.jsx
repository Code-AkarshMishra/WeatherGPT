import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
} from 'lucide-react';

function renderConditionIcon(condition) {
  switch (condition) {
    case 'storm':
      return <CloudLightning size={18} style={{ color: '#fbbf24' }} />;
    case 'rain':
      return <CloudRain size={18} style={{ color: '#38bdf8' }} />;
    case 'cloudy':
      return <Cloud size={18} style={{ color: '#cbd5e1' }} />;
    case 'snow':
      return <Snowflake size={18} style={{ color: '#bae6fd' }} />;
    default:
      return <Sun size={18} style={{ color: '#f59e0b' }} />;
  }
}

export default function DailyForecastCard({ daily = [] }) {
  if (!daily || daily.length === 0) return null;

  return (
    <div className="daily-forecast-card">
      <div className="daily-forecast-list">
        {daily.map((day, idx) => (
          <div key={idx} className="daily-row">
            {/* Date column (MM/DD) */}
            <span className="daily-date">{day.date}</span>

            {/* Day name column (Yesterday, Today, Tomorrow, Tue, etc.) */}
            <span className="daily-name">{day.dayName}</span>

            {/* Condition Icon + Rain Probability % */}
            <div className="daily-condition">
              <span className="daily-icon-wrapper">
                {renderConditionIcon(day.condition)}
              </span>
              {day.rainPop > 0 ? (
                <span className="daily-pop-badge">{day.rainPop}%</span>
              ) : (
                <span className="daily-pop-empty" />
              )}
            </div>

            {/* Min and Max Temperatures */}
            <div className="daily-temps">
              <span className="daily-temp-min">{day.minTemp}°</span>
              <span className="daily-temp-bar-mini" />
              <span className="daily-temp-max">{day.maxTemp}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
