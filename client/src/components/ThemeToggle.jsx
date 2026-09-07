import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="btn-theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      id="theme-toggle-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: 'var(--radius-full, 9999px)',
        background: 'var(--color-bg-card, #1f2937)',
        border: '1px solid var(--color-border, #374151)',
        color: isDark ? 'var(--color-sunlight, #fbbf24)' : 'var(--color-primary, #0284c7)',
        cursor: 'pointer',
        transition: 'all 200ms ease',
      }}
    >
      {isDark ? (
        <Sun size={18} style={{ transition: 'transform 250ms ease' }} />
      ) : (
        <Moon size={18} style={{ transition: 'transform 250ms ease' }} />
      )}
    </button>
  );
}
