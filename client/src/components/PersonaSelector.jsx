import { Sprout, Plane, Anchor, ShieldAlert, User, Check, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const PERSONAS = [
  {
    id: 'citizen',
    icon: User,
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  {
    id: 'kisan',
    icon: Sprout,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'aviation',
    icon: Plane,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  {
    id: 'marine',
    icon: Anchor,
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  {
    id: 'disaster',
    icon: ShieldAlert,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
];

export default function PersonaSelector({
  selectedRole = 'citizen',
  onSelectRole,
  showFullDetails = false,
}) {
  const { t } = useLanguage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showFullDetails && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {t('personas.selectorTitle')}
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            5 MoES Operational Modes
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showFullDetails ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(5, 1fr)',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {PERSONAS.map((item) => {
          const isSelected = selectedRole === item.id;
          const Icon = item.icon;
          const name = t(`personas.${item.id}.name`);
          const tag = t(`personas.${item.id}.tag`);
          const desc = t(`personas.${item.id}.desc`);

          return (
            <button
              key={item.id}
              onClick={() => onSelectRole(item.id)}
              style={{
                padding: showFullDetails ? '12px 14px' : '8px 10px',
                borderRadius: 14,
                border: isSelected ? `2px solid ${item.color}` : '1px solid var(--color-border)',
                background: isSelected ? item.bgColor : 'var(--color-bg-card)',
                color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: showFullDetails ? 'column' : 'row',
                alignItems: showFullDetails ? 'flex-start' : 'center',
                gap: showFullDetails ? 8 : 6,
                justifyContent: 'center',
                textAlign: 'left',
                transition: 'all 0.18s ease',
                boxShadow: isSelected ? `0 4px 14px ${item.color}25` : 'none',
                minWidth: showFullDetails ? 'auto' : 85,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div
                  style={{
                    width: showFullDetails ? 32 : 24,
                    height: showFullDetails ? 32 : 24,
                    borderRadius: 8,
                    background: `${item.color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color,
                  }}
                >
                  <Icon size={showFullDetails ? 18 : 14} />
                </div>
                {isSelected && <Check size={14} style={{ color: item.color }} />}
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, whiteSpace: showFullDetails ? 'normal' : 'nowrap' }}>
                  {name}
                </div>
                {showFullDetails && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
                    {desc}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
