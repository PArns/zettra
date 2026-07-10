import { useEffect, useRef, useState } from 'react';
import { api, type UserSettings } from '../lib/api';
import { getAccent, setAccent } from '../lib/accent';
import { LANGUAGES, useI18n } from '../i18n';
import { AccentPicker, Button, Field, Input, Segmented, ThemeSwitcher } from '../ui';
import { useToast } from './Toast';

type Tab = 'appearance' | 'profile' | 'security' | 'clipper' | 'plan';

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
          style={{
            transform: `scaleX(${limit == null ? 0.04 : pct / 100})`,
            opacity: limit == null ? 0.4 : 1,
          }}
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
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<Tab>('appearance');
  const [accent, setAccentState] = useState(getAccent());

  const [name, setName] = useState(displayName);
  const [mail, setMail] = useState(email);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
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
          <span className="modal-title">{t('settings.title')}</span>
          <button className="icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
          <nav className="settings-tabs">
            {(['appearance', 'profile', 'security', 'clipper', 'plan'] as Tab[]).map((tabId) => (
              <button
                key={tabId}
                className={`settings-tab ${tab === tabId ? 'active' : ''}`}
                onClick={() => setTab(tabId)}
              >
                {tabId === 'appearance'
                  ? `🎨 ${t('settings.appearance')}`
                  : tabId === 'profile'
                    ? `👤 ${t('settings.profile')}`
                    : tabId === 'security'
                      ? `🔒 ${t('settings.security')}`
                      : tabId === 'clipper'
                        ? `✂️ ${t('settings.clipper')}`
                        : `💳 ${t('settings.plan')}`}
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            {tab === 'appearance' && (
              <div className="stack">
                <div>
                  <div className="settings-label">{t('settings.theme')}</div>
                  <ThemeSwitcher onChange={(m) => void persist({ themeMode: m })} />
                </div>
                <div>
                  <div className="settings-label">{t('settings.accent')}</div>
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
                  <div className="settings-label">{t('settings.language')}</div>
                  <Segmented
                    ariaLabel={t('settings.language')}
                    value={lang}
                    onChange={(l) => {
                      setLang(l);
                      void persist({ language: l });
                    }}
                    options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
                  />
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <div className="stack">
                <Field label={t('settings.displayName')} htmlFor="set-name">
                  {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <Field label={t('settings.email')} htmlFor="set-email">
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
                  {savingProfile ? t('settings.saving') : t('settings.saveProfile')}
                </Button>
              </div>
            )}

            {tab === 'security' && (
              <div className="stack">
                <Field label={t('settings.currentPassword')} htmlFor="set-pw-cur">
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      value={pw.current}
                      onChange={(e) => setPw({ ...pw, current: e.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label={t('settings.newPassword')}
                  htmlFor="set-pw-new"
                  hint={t('auth.passwordHint')}
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      value={pw.next}
                      onChange={(e) => setPw({ ...pw, next: e.target.value })}
                    />
                  )}
                </Field>
                <Field label={t('settings.confirmPassword')} htmlFor="set-pw-conf">
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
                  {savingPw ? t('settings.saving') : t('settings.changePassword')}
                </Button>
              </div>
            )}

            {tab === 'clipper' && <WebClipperPanel />}

            {tab === 'plan' && (
              <div className="stack">
                <div className="plan-badge">
                  {t('settings.currentPlan')}:{' '}
                  <strong>{plan ? plan.tier.toUpperCase() : '—'}</strong>
                </div>
                {plan && (
                  <div className="stack" style={{ gap: 12 }}>
                    <UsageBar
                      label={t('settings.members')}
                      used={plan.usage.members}
                      limit={plan.limits.members}
                    />
                    <UsageBar
                      label={t('settings.spaces')}
                      used={plan.usage.spaces}
                      limit={plan.limits.spaces}
                    />
                    <UsageBar
                      label={t('settings.blocks')}
                      used={plan.usage.blocks}
                      limit={plan.limits.blocks}
                    />
                    <UsageBar
                      label={t('settings.storage')}
                      used={plan.usage.storageMb}
                      limit={plan.limits.storageMb}
                    />
                  </div>
                )}
                <p className="text-xs text-faint">{t('settings.planNote')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Web clipper setup (§8.3): a drag-to-bookmark-bar bookmarklet + a manual URL clip field. */
function WebClipperPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const bmRef = useRef<HTMLAnchorElement>(null);
  const origin = window.location.origin;
  // Runs on any page: opens Zettra with the current URL, which the app clips server-side.
  const bookmarklet = `javascript:(function(){window.open('${origin}/?clipUrl='+encodeURIComponent(location.href),'zettra');})();`;

  // React sanitizes a `javascript:` href in JSX (→ an error stub), so set it on the DOM directly.
  // The link stays draggable to the bookmarks bar with the real bookmarklet URL.
  useEffect(() => {
    bmRef.current?.setAttribute('href', bookmarklet);
  }, [bookmarklet]);

  const clip = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    try {
      await api.clip(u);
      setUrl('');
      toast.success(t('clipper.clipped'));
    } catch (err) {
      toast.error(`${t('clipper.failed')}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div>
        <div className="settings-label">{t('clipper.bookmarkletTitle')}</div>
        <p className="settings-hint">{t('clipper.bookmarkletHelp')}</p>
        {/* Draggable to the bookmarks bar (real href set via ref); clicking it here is a no-op. */}
        <a
          ref={bmRef}
          className="clipper-bookmarklet"
          onClick={(e) => e.preventDefault()}
          draggable
        >
          ✂️ {t('clipper.button')}
        </a>
      </div>
      <div>
        <div className="settings-label">{t('clipper.manualTitle')}</div>
        <div className="clipper-manual">
          <Input
            value={url}
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void clip()}
          />
          <Button onClick={() => void clip()} disabled={busy || !url.trim()}>
            {busy ? t('common.saving') : t('clipper.clip')}
          </Button>
        </div>
      </div>
    </div>
  );
}
