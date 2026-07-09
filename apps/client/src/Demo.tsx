import {
  BookmarkCard,
  Callout,
  Checklist,
  CoverHeader,
  FormulaTable,
  KanbanBoard,
  WeatherCard,
} from './blocks';
import { Badge, Button, Card, ThemeSwitcher } from './ui';

function Section({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * Standalone product showcase (reachable at `?demo=1`). Renders every content block and kit
 * primitive with sample data — no backend required — so the design can be reviewed and captured.
 */
export function Demo() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-3">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg font-extrabold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            Z
          </span>
          <span className="font-bold tracking-tight text-text">Zettra</span>
          <Badge tone="accent" className="ml-1">
            Component gallery
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="primary" size="sm" onClick={() => (window.location.search = '')}>
              Open app →
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="animate-fade-up">
          <CoverHeader
            cover="linear-gradient(120deg, #6d5efc 0%, #a855f7 45%, #ec4899 100%)"
            icon="🧠"
            title="Product roadmap"
            meta="Your second brain — entities as rows, rich text as JSON, connections you can trust."
          />
        </div>

        <Section kicker="Admonitions" title="Callouts">
          <div className="grid gap-3 sm:grid-cols-2">
            <Callout kind="info" title="Live collaboration">
              Every keystroke syncs through Yjs; the database is a projection of the document.
            </Callout>
            <Callout kind="tip" title="Supertags">
              Type <span className="font-mono">#project</span> to turn any note into a typed entity
              with its own fields.
            </Callout>
            <Callout kind="warning" title="Soft vs hard links">
              Semantic similarity is computed live and never written to the graph.
            </Callout>
            <Callout kind="danger" title="Permission-scoped reads">
              Every query is scoped to the spaces you can actually see.
            </Callout>
          </div>
        </Section>

        <Section kicker="Databases" title="Kanban board">
          <KanbanBoard
            initial={[
              {
                id: 'todo',
                title: 'To do',
                cards: [
                  { id: 'k1', title: 'Draft launch post', tag: 'Marketing', tone: 'blue' },
                  { id: 'k2', title: 'Design empty states', tag: 'Design', tone: 'accent' },
                ],
              },
              {
                id: 'doing',
                title: 'In progress',
                cards: [{ id: 'k3', title: 'Formula engine', tag: 'Eng', tone: 'green' }],
              },
              {
                id: 'done',
                title: 'Done',
                cards: [{ id: 'k4', title: 'Theme switcher', tag: 'Shipped', tone: 'green' }],
              },
            ]}
          />
          <p className="mt-2 text-xs text-faint">Drag cards between columns.</p>
        </Section>

        <Section kicker="Databases" title="Table with formulas">
          <FormulaTable
            headers={['Item', 'Qty', 'Unit €', 'Total €']}
            initial={[
              ['Keyboards', '4', '89', '=B1*C1'],
              ['Monitors', '2', '240', '=B2*C2'],
              ['Desks', '3', '150', '=B3*C3'],
              ['Total', '=SUM(B1:B3)', '', '=SUM(D1:D3)'],
            ]}
          />
          <p className="mt-2 text-xs text-faint">
            Click any cell to edit. Try <span className="font-mono">=AVG(D1:D3)</span>.
          </p>
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section kicker="Widgets" title="Weather">
            <WeatherCard
              weather={{
                location: 'Berlin, DE',
                tempC: 21,
                condition: 'Partly cloudy',
                glyph: '⛅',
                high: 24,
                low: 14,
                forecast: [
                  { day: 'Wed', glyph: '☀️', high: 25, low: 15 },
                  { day: 'Thu', glyph: '⛅', high: 23, low: 14 },
                  { day: 'Fri', glyph: '🌧️', high: 19, low: 12 },
                  { day: 'Sat', glyph: '⛅', high: 22, low: 13 },
                  { day: 'Sun', glyph: '☀️', high: 26, low: 16 },
                ],
              }}
            />
          </Section>

          <Section kicker="Widgets" title="Checklist">
            <Card>
              <Checklist
                initial={[
                  { id: 'c1', text: 'Set up the workspace', done: true },
                  { id: 'c2', text: 'Invite the team', done: true },
                  { id: 'c3', text: 'Create your first supertag', done: false },
                  { id: 'c4', text: 'Capture from email', done: false },
                ]}
              />
            </Card>
          </Section>
        </div>

        <Section kicker="Embeds" title="Web bookmarks">
          <div className="grid gap-3 sm:grid-cols-2">
            <BookmarkCard
              bookmark={{
                url: 'https://www.postgresql.org',
                title: 'PostgreSQL: The world’s most advanced open source database',
                description:
                  'The relational core behind Zettra — with pgvector for semantic search.',
                siteName: 'postgresql.org',
              }}
            />
            <BookmarkCard
              bookmark={{
                url: 'https://yjs.dev',
                title: 'Yjs — Shared editing',
                description: 'CRDT framework powering Zettra’s real-time, offline-first documents.',
                siteName: 'yjs.dev',
              }}
            />
          </div>
        </Section>

        <Section kicker="Foundations" title="Kit primitives">
          <Card className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <span className="mx-1 h-6 w-px bg-border" />
            <Badge tone="accent" dot>
              Accent
            </Badge>
            <Badge tone="green" dot>
              Synced
            </Badge>
            <Badge tone="amber" dot>
              Review
            </Badge>
            <Badge tone="red" dot>
              Overdue
            </Badge>
          </Card>
        </Section>
      </main>
    </div>
  );
}
