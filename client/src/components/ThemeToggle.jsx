import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="btn btn-icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`${theme === 'light' ? 'Dark' : 'Light'} mode`}
      id="theme-toggle-btn"
      style={{ fontSize: '1.1rem', minWidth: 44, minHeight: 44 }}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
