import { useEffect, useState } from 'react';
import { api, type UserSettings } from '../lib/api';
import { getAccent, setAccent } from '../lib/accent';
import { AccentPicker, Button, Field, Input, Segmented, ThemeSwitcher } from '../ui';
import { useToast } from './Toast';

type Tab = 'appearance' | 'profile' | 'security' | 'plan';

interface Plan {
  tier: 'free' | 'pro' | 'team';
  limits: {
    members: number | null;
    spaces: number | null;
    blocks: number | null;
    storageMb: number | null;
  };
  usage: { members: number; spaces: number; blocks: number; storageMb: number };
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="usage-row">
      <div className="usage-head">
        <span>{label}</span>
        <span className="usage-num">
          {used}
          {limit == null ? ' / ∞' : ` / ${limit}`}
        </span>
      </div>
      <div className="usage-track">
        <div
          className="usage-fill"
          style={{ width: `${limit == null ? 4 : pct}%`, opacity: limit == null ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
}

/**
 * Account & preferences dialog (§2): appearance (theme mode + accent), profile (name, email,
 * language), and security (password). Appearance changes apply instantly and persist to the
 * user's server-side settings so they follow the account across devices.
 */
export function SettingsDialog({
  email,
  displayName,
  onClose,
  onProfileSaved,
}: {
  email: string;
  displayName: string;
  onClose: () => void;
  onProfileSaved: (p: { email: string; displayName: string | null }) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('appearance');
  const [accent, setAccentState] = useState(getAccent());
  const [language, setLanguage] = useState<'de' | 'en'>('en');

  const [name, setName] = useState(displayName);
  const [mail, setMail] = useState(email);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        if (s.language) setLanguage(s.language);
      })
      .catch(() => undefined);
    api
      .tenantLimits()
      .then(setPlan)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const persist = (patch: UserSettings) => api.saveSettings(patch).catch(() => undefined);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await api.updateProfile({ displayName: name, email: mail });
      onProfileSaved(res);
      toast.success('Profile updated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (pw.next !== pw.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      await api.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">Settings</span>
          <button className="icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
          <nav className="settings-tabs">
            {(['appearance', 'profile', 'security', 'plan'] as Tab[]).map((t) => (
              <button
                key={t}
                className={`settings-tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'appearance'
                  ? '🎨 Appearance'
                  : t === 'profile'
                    ? '👤 Profile'
                    : t === 'security'
                      ? '🔒 Security'
                      : '💳 Plan'}
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            {tab === 'appearance' && (
              <div className="stack">
                <div>
                  <div className="settings-label">Theme</div>
                  <ThemeSwitcher onChange={(m) => void persist({ themeMode: m })} />
                </div>
                <div>
                  <div className="settings-label">Accent color</div>
                  <AccentPicker
                    value={accent}
                    onChange={(id) => {
                      setAccent(id);
                      setAccentState(id);
                      void persist({ accent: id });
                    }}
                  />
                </div>
                <div>
                  <div className="settings-label">Language</div>
                  <Segmented
                    ariaLabel="Language"
                    value={language}
                    onChange={(l) => {
                      setLanguage(l);
                      document.documentElement.lang = l;
                      void persist({ language: l });
                    }}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'de', label: 'Deutsch' },
                    ]}
                  />
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <div className="stack">
                <Field label="Display name" htmlFor="set-name">
                  {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <Field label="Email" htmlFor="set-email">
                  {(id) => (
                    <Input
                      id={id}
                      type="email"
                      value={mail}
                      onChange={(e) => setMail(e.target.value)}
                    />
                  )}
                </Field>
                <Button variant="primary" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            )}

            {tab === 'security' && (
              <div className="stack">
                <Field label="Current password" htmlFor="set-pw-cur">
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      value={pw.current}
                      onChange={(e) => setPw({ ...pw, current: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="New password" htmlFor="set-pw-new" hint="At least 8 characters">
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      value={pw.next}
                      onChange={(e) => setPw({ ...pw, next: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="Confirm new password" htmlFor="set-pw-conf">
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      value={pw.confirm}
                      onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                    />
                  )}
                </Field>
                <Button variant="primary" onClick={savePassword} disabled={savingPw}>
                  {savingPw ? 'Saving…' : 'Change password'}
                </Button>
              </div>
            )}

            {tab === 'plan' && (
              <div className="stack">
                <div className="plan-badge">
                  Current plan: <strong>{plan ? plan.tier.toUpperCase() : '—'}</strong>
                </div>
                {plan && (
                  <div className="stack" style={{ gap: 12 }}>
                    <UsageBar
                      label="Members"
                      used={plan.usage.members}
                      limit={plan.limits.members}
                    />
                    <UsageBar label="Spaces" used={plan.usage.spaces} limit={plan.limits.spaces} />
                    <UsageBar label="Blocks" used={plan.usage.blocks} limit={plan.limits.blocks} />
                    <UsageBar
                      label="Storage (MB)"
                      used={plan.usage.storageMb}
                      limit={plan.limits.storageMb}
                    />
                  </div>
                )}
                <p className="text-xs text-faint">
                  Limits are enforced when creating spaces and blocks. Change the tier on the tenant
                  to upgrade.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
