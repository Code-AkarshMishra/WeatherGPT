import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Globe2,
  BellRing,
  Languages,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function RoadmapNext() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const roadmapItems = [
    {
      icon: TrendingUp,
      badge: t('roadmap.features.climate.status', 'Live & Active'),
      badgeColor: '#0284c7',
      bgLight: 'rgba(2, 132, 199, 0.1)',
      title: t('roadmap.features.climate.title', 'Historical Climate Trends'),
      desc: t('roadmap.features.climate.desc', 'Decadal monsoon shifting analysis and 30-year temperature & precipitation anomaly tracking against IMD baselines.'),
      action: () => navigate('/weather'),
    },
    {
      icon: Globe2,
      badge: t('roadmap.features.nwp.status', 'Live & Active'),
      badgeColor: '#0f766e',
      bgLight: 'rgba(15, 118, 110, 0.12)',
      title: t('roadmap.features.nwp.title', 'NWP Numerical Forecasting'),
      desc: t('roadmap.features.nwp.desc', 'Direct ingest of NCUM 4km, ECMWF IFS 9km, and GFS 13km numerical ensembles with isobaric levels & CAPE.'),
      action: () => navigate('/weather'),
    },
    {
      icon: BellRing,
      badge: t('roadmap.features.alerts.status', 'Live & Active'),
      badgeColor: '#ea580c',
      bgLight: 'rgba(234, 88, 12, 0.1)',
      title: t('roadmap.features.alerts.title', 'Proactive Severe Alerts'),
      desc: t('roadmap.features.alerts.desc', '24/7 background CRON daemon with automated email and push alerts for farmers and coastal regions.'),
      action: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      icon: Languages,
      badge: t('roadmap.features.languages.status', 'Live & Active'),
      badgeColor: '#16a34a',
      bgLight: 'rgba(22, 163, 74, 0.1)',
      title: t('roadmap.features.languages.title', 'All 22 Regional Languages'),
      desc: t('roadmap.features.languages.desc', 'Full multilingual coverage across all 22 official 8th Schedule Indian languages with neural voice readout.'),
      action: () => {
        const btn = document.getElementById('lang-selector-btn');
        if (btn) btn.click();
      },
    },
  ];

  return (
    <div
      style={{
        marginTop: 20,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 20,
        padding: '20px 24px',
        boxShadow: 'var(--shadow-sm)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: '6px',
              borderRadius: 10,
              background: 'rgba(30, 136, 229, 0.15)',
              color: 'var(--color-primary)',
              display: 'flex',
            }}
          >
            <Sparkles size={18} />
          </span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
              }}
            >
              {t('roadmap.headerTitle', 'MoES & IMD Advanced Forecasting Pipeline')}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              {t('roadmap.headerSubtitle', 'High-resolution NWP numerical integrations, proactive early warnings, and multilingual capabilities')}
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.7rem',
            padding: '3px 10px',
            borderRadius: 9999,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: 'var(--color-success, #10b981)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <CheckCircle2 size={12} />
          {t('roadmap.badge', 'Live & Deployed')}
        </span>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {roadmapItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.15 }}
              onClick={item.action}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 14,
                padding: '16px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: item.bgLight,
                    color: item.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} />
                </div>

                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: item.badgeColor,
                    background: item.bgLight,
                    padding: '3px 8px',
                    borderRadius: 9999,
                    whiteSpace: 'nowrap',
                    border: `1px solid ${item.badgeColor}30`,
                  }}
                >
                  {item.badge}
                </span>
              </div>

              <h4
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                {item.title}
              </h4>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.76rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.45,
                  flex: 1,
                }}
              >
                {item.desc}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', fontSize: '0.74rem', fontWeight: 700, marginTop: 4 }}>
                <span>{t('common.learnMore', 'Explore Feature')}</span>
                <ArrowRight size={12} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
