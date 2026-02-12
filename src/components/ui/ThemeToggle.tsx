import { motion } from 'motion/react';
import { useTheme } from '../../hooks/useTheme';

/**
 * ThemeToggle component with sun/moon icons and smooth animation.
 * Positioned fixed in the top-right corner.
 */
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors duration-300"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
    >
      <motion.div
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ duration: 0.3 }}
        className="w-5 h-5 flex items-center justify-center"
      >
        {isDark ? (
          // Moon icon
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          // Sun icon
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm4.293 1.293a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414L14.586 4.707a1 1 0 010-1.414zm2.828 2.828a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zm.707 4.171a1 1 0 11-1.414-1.414l1.414-1.414a1 1 0 111.414 1.414l-1.414 1.414zM10 18a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm4-3a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 110-2 1 1 0 010 2zm-4-4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 110-2 1 1 0 010 2zM4.586 4.586a1 1 0 011.414 0L7.414 6a1 1 0 01-1.414 1.414L4.586 5.414a1 1 0 010-1.414zM2 10a1 1 0 011-1h2a1 1 0 110 2H3a1 1 0 01-1-1zm12.95 7.071a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zM2.458 12.971a1 1 0 011.414 0L5.886 15.9a1 1 0 01-1.414 1.414L1.458 14.985a1 1 0 010-1.414zm0-4.242a1 1 0 011.414 0l2.828 2.829a1 1 0 11-1.414 1.414L1.458 9.743a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </motion.div>
    </motion.button>
  );
}
