import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

type Theme = 'light' | 'dark';

/**
 * A hook for managing theme state with localStorage persistence and system preference detection.
 * Applies the theme class to the <html> element and provides toggle functionality.
 *
 * @returns An object with { theme, toggleTheme, isDark }
 */
export function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [storedTheme, setStoredTheme] = useLocalStorage<Theme>('undercover-theme', 'dark');

  // Determine initial theme: stored > system preference > default (dark)
  const getInitialTheme = (): Theme => {
    if (storedTheme) return storedTheme;
    
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    
    return 'dark';
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply theme to DOM on mount and when theme changes
  useEffect(() => {
    setMounted(true);
    const htmlElement = document.documentElement;
    
    if (theme === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
    
    // Persist to localStorage
    setStoredTheme(theme);
  }, [theme, setStoredTheme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return {
      theme: 'dark' as const,
      toggleTheme: () => {},
      isDark: true,
    };
  }

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  };
}
