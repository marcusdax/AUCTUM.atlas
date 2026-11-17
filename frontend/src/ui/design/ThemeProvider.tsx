import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import designTokens from './tokens.json';

type Theme = typeof designTokens;

interface ThemeContextType {
  theme: Theme;
  isReducedMotion: boolean;
  toggleReducedMotion: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Listen for prefers-reduced-motion changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleReducedMotion = () => {
    setIsReducedMotion((prev) => !prev);
  };

  const theme: Theme = designTokens;

  // Inject CSS custom properties from tokens for global consistency
  useEffect(() => {
    const root = document.documentElement;
    // Ground colors
    root.style.setProperty('--orbital-bp-0', theme.ground['bp-0']);
    root.style.setProperty('--orbital-bp-1', theme.ground['bp-1']);
    root.style.setProperty('--orbital-floor-line', theme.ground['floor-line']);
    root.style.setProperty('--orbital-floor-line-2', theme.ground['floor-line-2']);
    // Machined surfaces
    root.style.setProperty('--orbital-plate-hi', theme.machined_surfaces['plate-hi']);
    root.style.setProperty('--orbital-plate-lo', theme.machined_surfaces['plate-lo']);
    root.style.setProperty('--orbital-hair', theme.machined_surfaces['hair']);
    root.style.setProperty('--orbital-hair-hi', theme.machined_surfaces['hair-hi']);
    root.style.setProperty('--orbital-etch', theme.machined_surfaces['etch']);
    root.style.setProperty('--orbital-chrome-a', theme.machined_surfaces['chrome-a']);
    root.style.setProperty('--orbital-chrome-b', theme.machined_surfaces['chrome-b']);
    root.style.setProperty('--orbital-chrome-c', theme.machined_surfaces['chrome-c']);
    // Signal colors
    root.style.setProperty('--orbital-cyan', theme.signal['cyan']);
    root.style.setProperty('--orbital-trace', theme.signal['trace']);
    root.style.setProperty('--orbital-sage', theme.signal['sage']);
    root.style.setProperty('--orbital-gold', theme.signal['gold']);
    root.style.setProperty('--orbital-amber', theme.signal['amber']);
    root.style.setProperty('--orbital-red', theme.signal['red']);
    root.style.setProperty('--orbital-mock', theme.signal['mock']);
    root.style.setProperty('--orbital-violet', theme.signal['violet']);
    // Type colors
    root.style.setProperty('--orbital-text-body', theme.type.body);
    root.style.setProperty('--orbital-text-headings', theme.type.headings);
    root.style.setProperty('--orbital-text-muted', theme.type.muted);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, isReducedMotion, toggleReducedMotion }}>
      <div
        className="min-h-screen"
        style={{
          background: theme.ground['bp-0'],
          color: theme.type.body,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;