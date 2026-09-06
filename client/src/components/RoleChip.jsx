export default function RoleChip({ role, label }) {
  const ROLE_ICONS = {
    farmer: '🌾', citizen: '👤', researcher: '🔬',
    aviation: '✈️', marine: '⚓', flood_disaster: '🚨',
    climate_analyst: '🌍', urban_planner: '🏙️',
  };

  return (
    <span className="role-chip" title={`Current role: ${label}`}>
      <span aria-hidden="true">{ROLE_ICONS[role] || '🌤️'}</span>
      {label}
    </span>
  );
}
