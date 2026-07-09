import { useEffect, useState } from 'react';
import { getMode, setMode, type ThemeMode } from '../lib/theme';
import { Segmented } from './Segmented';

const OPTIONS = [
  { value: 'light' as const, label: '☀', title: 'Light' },
  { value: 'system' as const, label: '🖥', title: 'Match system' },
  { value: 'dark' as const, label: '☾', title: 'Dark' },
];

/** Light / system / dark control bound to the theme store. */
export function ThemeSwitcher({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const [mode, setLocal] = useState<ThemeMode>(() => getMode());

  // Keep in sync if another tab changed the persisted mode.
  useEffect(() => {
    const onStorage = () => setLocal(getMode());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <Segmented
      ariaLabel="Theme"
      size={size}
      value={mode}
      options={OPTIONS}
      onChange={(m) => {
        setMode(m);
        setLocal(m);
      }}
    />
  );
}
