'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemePreferences } from './ThemeProvider';

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemePreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <span className="size-4" />
      </Button>
    );
  }

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-md border border-border/80 bg-card/80"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Current mode: ${theme}`}
    >
      {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
