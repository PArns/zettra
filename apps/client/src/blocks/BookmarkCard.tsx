import { Card } from '../ui';

export interface Bookmark {
  url: string;
  title: string;
  description?: string;
  siteName?: string;
  favicon?: string;
  image?: string;
}

/** Rich link preview card (web bookmark). */
export function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const host = safeHost(bookmark.url);
  return (
    <a href={bookmark.url} target="_blank" rel="noreferrer" className="block no-underline">
      <Card interactive padded={false} className="flex overflow-hidden">
        <div className="min-w-0 flex-1 p-3.5">
          <div className="truncate text-sm font-semibold text-text">{bookmark.title}</div>
          {bookmark.description && (
            <div className="mt-1 line-clamp-2 text-[13px] text-muted">{bookmark.description}</div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-faint">
            {bookmark.favicon ? (
              <img src={bookmark.favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />
            ) : (
              <span aria-hidden>🔗</span>
            )}
            <span className="truncate">{bookmark.siteName ?? host}</span>
          </div>
        </div>
        {bookmark.image && (
          <div
            className="hidden w-36 shrink-0 bg-cover bg-center sm:block"
            style={{ backgroundImage: `url(${bookmark.image})` }}
            aria-hidden
          />
        )}
      </Card>
    </a>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
