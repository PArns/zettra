import { describe, expect, it } from 'vitest';
import { LANGUAGES, STRINGS, isLang, translate, type Lang } from './strings';

const en = STRINGS.en;
const keys = Object.keys(en) as (keyof typeof en)[];

describe('i18n catalog', () => {
  it('every language defines exactly the English key set', () => {
    for (const { id } of LANGUAGES) {
      const catalog = STRINGS[id];
      expect(Object.keys(catalog).sort()).toEqual([...keys].sort());
    }
  });

  it('no language leaves a value empty', () => {
    for (const { id } of LANGUAGES) {
      for (const key of keys) {
        expect(STRINGS[id][key].trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('translate', () => {
  it('returns the requested language string when present', () => {
    expect(translate('de', 'nav.signOut')).toBe('Abmelden');
    expect(translate('fr', 'nav.signOut')).toBe('Se déconnecter');
  });

  it('falls back to English for a language with no catalog', () => {
    // An unknown language is not reachable through the type system, but the
    // resolver must still degrade gracefully rather than throw.
    const bogus = 'xx' as unknown as Lang;
    expect(translate(bogus, 'nav.signOut')).toBe(en['nav.signOut']);
  });

  it('falls back to the key itself when the key is unknown', () => {
    const missing = 'does.not.exist' as unknown as keyof typeof en;
    expect(translate('en', missing)).toBe('does.not.exist');
  });
});

describe('isLang', () => {
  it('accepts the four supported languages', () => {
    for (const { id } of LANGUAGES) expect(isLang(id)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isLang('xx')).toBe(false);
    expect(isLang('')).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(42)).toBe(false);
  });
});
