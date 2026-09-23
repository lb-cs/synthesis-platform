'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, MoonStar, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import type { LucideIcon } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ThemeOption = {
  value: 'system' | 'light' | 'dark';
  label: string;
  icon: LucideIcon;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'System theme', icon: Monitor },
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: MoonStar },
];

function subscribeToNothing() {
  return () => {};
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  // theme is unknown on the server, so show nothing pressed until hydration is done.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const pressed = isHydrated && theme ? [theme] : [];

  return (
    <ToggleGroup
      aria-label="Theme"
      value={pressed}
      onValueChange={(next) => {
        // Clicking the active option would clear the group; keep the current theme instead.
        if (next.length === 0) {
          return;
        }

        setTheme(next[0]);
      }}
      spacing={0.5}
      className="rounded-full border p-0.5"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;

        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            size="sm"
            className="rounded-full px-0 text-muted-foreground aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-border"
          >
            <Icon />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
