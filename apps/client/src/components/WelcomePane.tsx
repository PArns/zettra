import { useT } from '../i18n';
import { clickable } from '../lib/a11y';

/**
 * First-run welcome shown when a workspace has no content yet (empty inbox, no supertags). Orients
 * a new user with the three core moves — capture, structure, drop — each wired to a real action.
 */
export function WelcomePane({
  onCapture,
  onCreateTag,
}: {
  onCapture: () => void;
  onCreateTag: () => void;
}) {
  const t = useT();
  const cards = [
    {
      glyph: '✎',
      title: t('welcome.captureTitle'),
      body: t('welcome.captureBody'),
      onClick: onCapture,
    },
    { glyph: '🏷️', title: t('welcome.tagTitle'), body: t('welcome.tagBody'), onClick: onCreateTag },
    { glyph: '📎', title: t('welcome.dropTitle'), body: t('welcome.dropBody') },
  ];
  return (
    <div className="welcome">
      <div className="welcome-hero glass-strong">
        <div className="welcome-mark" aria-hidden>
          Z
        </div>
        <h1>{t('welcome.title')}</h1>
        <p>{t('welcome.subtitle')}</p>
      </div>
      <div className="welcome-cards">
        {cards.map((c) => {
          const interactive = c.onClick
            ? clickable(c.onClick)
            : { style: { cursor: 'default' as const } };
          return (
            <div key={c.title} className="welcome-card card" {...interactive}>
              <div className="welcome-card-glyph" aria-hidden>
                {c.glyph}
              </div>
              <div className="welcome-card-title">{c.title}</div>
              <div className="welcome-card-body">{c.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
