import type { ReactNode } from 'react';

/**
 * Page header with a cover image and an overlapping icon (Notion-style). The cover can be an
 * image URL or a CSS gradient string.
 */
export function CoverHeader({
  cover,
  icon,
  title,
  meta,
}: {
  cover: string;
  icon: string;
  title: ReactNode;
  meta?: ReactNode;
}) {
  const isImage = /^(https?:|data:|\/)/.test(cover);
  return (
    <div className="mb-4">
      <div
        className="h-40 w-full rounded-xl bg-cover bg-center"
        style={isImage ? { backgroundImage: `url(${cover})` } : { background: cover }}
        aria-hidden
      />
      <div className="relative px-4">
        <div className="-mt-8 mb-2 grid h-16 w-16 place-items-center rounded-2xl border-4 border-[var(--bg)] bg-surface text-4xl shadow">
          {icon}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        {meta && <div className="mt-1 text-sm text-faint">{meta}</div>}
      </div>
    </div>
  );
}
