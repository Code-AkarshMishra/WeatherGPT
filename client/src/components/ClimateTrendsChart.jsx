import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { TrendingUp, Thermometer, CloudRain, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { intelligenceApi } from '../services/api';

// Baseline fallback data
const ANNUAL_TEMP_ANOMALY_DATA = [
  { year: '2015', anomaly: 0.67, normal: 24.0, observed: 24.67, baseline: 0 },
  { year: '2016', anomaly: 0.91, normal: 24.0, observed: 24.91, baseline: 0 },
  { year: '2017', anomaly: 0.78, normal: 24.0, observed: 24.78, baseline: 0 },
  { year: '2018', anomaly: 0.54, normal: 24.0, observed: 24.54, baseline: 0 },
  { year: '2019', anomaly: 0.61, normal: 24.0, observed: 24.61, baseline: 0 },
  { year: '2020', anomaly: 0.49, normal: 24.0, observed: 24.49, baseline: 0 },
  { year: '2021', anomaly: 0.63, normal: 24.0, observed: 24.63, baseline: 0 },
  { year: '2022', anomaly: 0.84, normal: 24.0, observed: 24.84, baseline: 0 },
  { year: '2023', anomaly: 1.02, normal: 24.0, observed: 25.02, baseline: 0 },
  { year: '2024', anomaly: 0.96, normal: 24.0, observed: 24.96, baseline: 0 },
  { year: '2025', anomaly: 1.15, normal: 24.0, observed: 25.15, baseline: 0 },
];

const MONSOON_RAINFALL_DEPARTURE = [
  { year: '2016', lpaPercentage: 97, departure: -3, status: 'Normal' },
  { year: '2017', lpaPercentage: 95, departure: -5, status: 'Normal' },
  { year: '2018', lpaPercentage: 91, departure: -9, status: 'Below Normal' },
  { year: '2019', lpaPercentage: 110, departure: +10, status: 'Above Normal' },
  { year: '2020', lpaPercentage: 109, departure: +9, status: 'Above Normal' },
  { year: '2021', lpaPercentage: 99, departure: -1, status: 'Normal' },
  { year: '2022', lpaPercentage: 106, departure: +6, status: 'Above Normal' },
  { year: '2023', lpaPercentage: 94, departure: -6, status: 'Normal' },
  { year: '2024', lpaPercentage: 108, departure: +8, status: 'Above Normal' },
  { year: '2025', lpaPercentage: 102, departure: +2, status: 'Normal' },
];

const MONTHLY_NORMALS_SAMPLE = [
  { month: 'Jan', normalTemp: 18.2, normalRain: 18 },
  { month: 'Feb', normalTemp: 21.4, normalRain: 16 },
  { month: 'Mar', normalTemp: 27.1, normalRain: 12 },
  { month: 'Apr', normalTemp: 32.5, normalRain: 15 },
  { month: 'May', normalTemp: 35.8, normalRain: 32 },
  { month: 'Jun', normalTemp: 33.4, normalRain: 168 },
  { month: 'Jul', normalTemp: 29.8, normalRain: 285 },
  { month: 'Aug', normalTemp: 28.9, normalRain: 262 },
  { month: 'Sep', normalTemp: 28.5, normalRain: 172 },
  { month: 'Oct', normalTemp: 26.2, normalRain: 48 },
  { month: 'Nov', normalTemp: 22.0, normalRain: 12 },
  { month: 'Dec', normalTemp: 18.6, normalRain: 8 },
];

export default function ClimateTrendsChart({ city = 'National (All-India)', lat = null, lon = null }) {
  const { t } = useLanguage();
  const [activeMetric, setActiveMetric] = useState('temp_anomaly'); // 'temp_anomaly' | 'monsoon_rain' | 'monthly_normals'
  const [liveClimate, setLiveClimate] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchClimate() {
      try {
        const res = await intelligenceApi.getClimateAnalysis({
          location: {
            name: city,
            lat: lat ? Number(lat) : undefined,
            lon: lon ? Number(lon) : undefined,
          },
        });
        if (isMounted && res.data?.data) {
          setLiveClimate(res.data.data);
        }
      } catch (e) {
        console.warn('Climate trend live fetch fallback:', e);
      }
    }
    fetchClimate();
    return () => { isMounted = false; };
  }, [city, lat, lon]);

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 20,
        padding: '22px 24px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 9999,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: 'var(--color-primary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <TrendingUp size={13} /> {t('climate.badge', 'IMD CLIMATE INTEL')}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {t('climate.lpaBaseline', '1991–2020 Long Period Average (LPA) Baseline')}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {t('climate.decadalTrends', 'Decadal Climate Trends & Departure Analytics')}
          </h3>
        </div>

        {/* View Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.6))',
            padding: 4,
            borderRadius: 12,
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setActiveMetric('temp_anomaly')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: activeMetric === 'temp_anomaly' ? 'var(--color-primary)' : 'transparent',
              color: activeMetric === 'temp_anomaly' ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Thermometer size={14} /> {t('climate.tempAnomaly', 'Temp Anomaly')}
          </button>
          <button
            onClick={() => setActiveMetric('monsoon_rain')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: activeMetric === 'monsoon_rain' ? 'var(--color-primary)' : 'transparent',
              color: activeMetric === 'monsoon_rain' ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <CloudRain size={14} /> {t('climate.monsoonLpa', 'Monsoon LPA Departure')}
          </button>
          <button
            onClick={() => setActiveMetric('monthly_normals')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: activeMetric === 'monthly_normals' ? 'var(--color-primary)' : 'transparent',
              color: activeMetric === 'monthly_normals' ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={14} /> {t('climate.climatology12m', '12-Month Climatology')}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: 280, width: '100%', marginTop: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'temp_anomaly' ? (
            <LineChart data={ANNUAL_TEMP_ANOMALY_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
                domain={[0, 1.5]}
                unit="°C"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-primary)',
                }}
                formatter={(val) => [`+${val}°C above LPA normal`, t('climate.tempAnomaly', 'Temp Anomaly')]}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '1.0°C Warming Threshold', fill: '#ef4444', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="anomaly"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ r: 4, fill: '#f97316' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : activeMetric === 'monsoon_rain' ? (
            <BarChart data={MONSOON_RAINFALL_DEPARTURE} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
                domain={[70, 130]}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-primary)',
                }}
                formatter={(val, name, item) => [
                  `${val}% of LPA (${item.payload.departure > 0 ? '+' : ''}${item.payload.departure}%)`,
                  `Monsoon Rainfall (${item.payload.status})`,
                ]}
              />
              <ReferenceLine y={100} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: '100% LPA (868.6 mm)', fill: '#38bdf8', fontSize: 10 }} />
              <ReferenceLine y={96} stroke="#eab308" strokeDasharray="2 2" />
              <ReferenceLine y={104} stroke="#eab308" strokeDasharray="2 2" />
              <Bar
                dataKey="lpaPercentage"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <BarChart data={MONTHLY_NORMALS_SAMPLE} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                yAxisId="left"
                stroke="#38bdf8"
                fontSize={11}
                tickLine={false}
                unit="mm"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f97316"
                fontSize={11}
                tickLine={false}
                unit="°C"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-primary)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
              <Bar yAxisId="left" dataKey="normalRain" name="Normal Rain (mm)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="normalTemp" name="Mean Temp (°C)" stroke="#f97316" strokeWidth={2} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Insight Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: 'rgba(56, 189, 248, 0.06)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 10,
          padding: '10px 14px',
        }}
      >
        <Info size={16} style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
          <strong>{t('climate.normalsReference', 'MoES Climate Normals Reference')}:</strong> {t('climate.referenceNote', "India's all-India mean annual temperature anomaly has risen by +0.7°C over the last 30-year period (1991–2020 baseline vs 1901–1930). 2023 and 2024 ranked among the warmest on record according to IMD Annual Climate Summaries.")}
        </p>
      </div>
    </div>
  );
}
