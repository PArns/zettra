import { Readability } from '@mozilla/readability';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BlockDto, BlockSource } from '@zettra/shared';
import { RequestContext } from '../../common/request-context';
import { BlockService } from '../block/block.service';
import { toBlockDto } from '../../common/block-dto';

interface Article {
  title: string;
  text: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
}

/**
 * Web clipper (§8.3): fetch a URL server-side, extract the readable article (Mozilla Readability
 * over a lightweight linkedom DOM), and materialize it as a `web_clip` block — a title heading, a
 * source bookmark, and the article body as paragraphs. Because the block's source is `web_clip`,
 * it flows through the normal capture pipeline: auto-tag (#webpage), embed, and task extraction.
 */
@Injectable()
export class ClipService {
  private readonly logger = new Logger(ClipService.name);

  constructor(private readonly blocks: BlockService) {}

  async clip(ctx: RequestContext, url: string): Promise<BlockDto> {
    const spaceId = ctx.visibleSpaceIds[0];
    if (!spaceId) throw new BadRequestException('No space available to clip into');
    const clean = normalizeUrl(url);
    const html = await this.fetchHtml(clean);
    const article = await extractArticle(html);
    const block = await this.blocks.create(ctx, {
      spaceId,
      content: articleToBlocks(article, clean) as unknown as Record<string, unknown>[],
      source: BlockSource.WebClip,
      sourceRef: clean,
    });
    this.logger.log(`Clipped "${article.title}" from ${clean}`);
    return toBlockDto(block, await this.blocks.tagIdsFor(block.id));
  }

  /** Fetch page HTML with a browser-like UA and a hard timeout; never hang the request. */
  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent':
            'Mozilla/5.0 (compatible; ZettraClipper/1.0; +https://github.com/PArns/zettra)',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) throw new BadRequestException(`Could not fetch the page (HTTP ${res.status})`);
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('html') && !type.includes('xml')) {
        throw new BadRequestException('That URL is not an HTML page');
      }
      return await res.text();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Could not fetch the page: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Only http(s) URLs; reject anything else (defense against SSRF-ish schemes / typos). */
function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new BadRequestException('That is not a valid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) URLs can be clipped');
  }
  return u.toString();
}

/** Minimal shape of the linkedom document we touch (the server has no DOM lib). */
interface MinimalEl {
  textContent?: string | null;
}
interface MinimalDoc {
  querySelector(sel: string): MinimalEl | null;
  body?: MinimalEl | null;
}
interface LinkedomModule {
  parseHTML(html: string): { document: MinimalDoc };
}

/** Run Readability over the page; fall back to <title> + body text if it can't parse an article. */
async function extractArticle(html: string): Promise<Article> {
  // linkedom is ESM; import via a computed specifier so this CommonJS build stays a runtime import.
  const moduleName = 'linkedom';
  const { parseHTML } = (await import(/* @vite-ignore */ moduleName)) as unknown as LinkedomModule;
  const { document } = parseHTML(html);
  let parsed: ReturnType<Readability['parse']> = null;
  try {
    // Readability expects a DOM Document; linkedom's is structurally compatible at runtime.
    parsed = new Readability(document as never).parse();
  } catch {
    parsed = null;
  }
  const title =
    parsed?.title?.trim() ||
    document.querySelector('title')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim() ||
    'Clipped page';
  const text = (parsed?.textContent ?? document.body?.textContent ?? '').trim();
  return {
    title,
    text,
    byline: parsed?.byline?.trim() || null,
    siteName: parsed?.siteName?.trim() || null,
    excerpt: parsed?.excerpt?.trim() || null,
  };
}

/** BlockNote doc for a clipped article: title heading, source bookmark, then body paragraphs. */
function articleToBlocks(article: Article, url: string): unknown[] {
  const blocks: unknown[] = [
    {
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: article.title, styles: {} }],
    },
    {
      type: 'bookmark',
      props: {
        url,
        title: [article.siteName, article.byline].filter(Boolean).join(' · ') || article.title,
        description: article.excerpt ?? '',
      },
    },
  ];
  const paras = article.text
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 1);
  for (const p of paras.slice(0, 300)) {
    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: p, styles: {} }] });
  }
  if (paras.length === 0) {
    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: article.excerpt ?? '', styles: {} }] });
  }
  return blocks;
}
