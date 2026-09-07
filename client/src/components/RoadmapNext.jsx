import { motion } from 'framer-motion';
import {
  TrendingUp,
  Globe2,
  BellRing,
  Languages,
  Sparkles,
} from 'lucide-react';

export default function RoadmapNext() {
  const roadmapItems = [
    {
      icon: TrendingUp,
      badge: 'In Development',
      badgeColor: '#0284c7',
      bgLight: 'rgba(2, 132, 199, 0.08)',
      title: 'Historical Climate Trends',
      desc: 'Decadal monsoon shifting analysis and 40-year precipitation anomaly tracking against IMD baselines.',
    },
    {
      icon: Globe2,
      badge: 'Pipeline Ready',
      badgeColor: '#0f766e',
      bgLight: 'rgba(15, 118, 110, 0.1)',
      title: 'NWP Numerical Forecasting',
      desc: 'Direct ingest of GFS 0.25° and NCMRWF high-resolution numerical ensembles for 15-day projections.',
    },
    {
      icon: BellRing,
      badge: 'Beta Testing',
      badgeColor: '#ea580c',
      bgLight: 'rgba(234, 88, 12, 0.08)',
      title: 'Proactive Severe Alerts',
      desc: 'Automated push notifications and SMS alerts for farmers and coastal fishermen before gale-force winds.',
    },
    {
      icon: Languages,
      badge: 'Scaling Up',
      badgeColor: '#16a34a',
      bgLight: 'rgba(22, 163, 74, 0.08)',
      title: 'All 22 Regional Languages',
      desc: 'Full multilingual expansion across 22 official Indian regional languages with neural voice readout.',
    },
  ];

  return (
    <div
      style={{
        marginTop: 20,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '5px',
              borderRadius: 8,
              background: 'rgba(30, 136, 229, 0.1)',
              color: 'var(--color-primary)',
              display: 'flex',
            }}
          >
            <Sparkles size={16} />
          </span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '0.96rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              MoES & IMD Advanced Forecasting Pipeline
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
              Upcoming NWP model integrations, early warnings, and multilingual capabilities
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.68rem',
            padding: '2px 9px',
            borderRadius: 9999,
            background: 'rgba(30, 136, 229, 0.08)',
            border: '1px solid rgba(30, 136, 229, 0.2)',
            color: 'var(--color-primary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Strategic Alignment
        </span>
      </div>

      {/* Balanced 4-Item Grid — strictly 4 cols on desktop, 2x2 on tablet, 1 col on mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {roadmapItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '14px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: item.bgLight,
                    color: item.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} />
                </div>

                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 600,
                    color: item.badgeColor,
                    background: item.bgLight,
                    padding: '2px 7px',
                    borderRadius: 9999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.badge}
                </span>
              </div>

              <h4
                style={{
                  margin: 0,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {item.title}
              </h4>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                {item.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
