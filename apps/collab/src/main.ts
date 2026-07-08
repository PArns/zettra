import { Server } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';
import jwt from 'jsonwebtoken';
import { loadCollabConfig } from './config';
import { yDocToBlocks } from './doc-projection';

/**
 * Hocuspocus Yjs collaboration server (§13.1). Deployed separately from the API and
 * coordinated through Redis pubsub so the collaboration tier scales independently (§4).
 *
 * - onAuthenticate: verify the same JWT the API issues; reject anonymous connections.
 * - Redis extension: multi-instance awareness + document broadcast.
 * - onStoreDocument: debounced persistence hook — projects the settled doc to rows by calling
 *   the API's internal sync endpoint (§8.7). The Yjs doc stays the source of truth (inv. 7).
 *
 * Document naming convention: the document name IS the block id.
 */
const config = loadCollabConfig();

interface TokenClaims {
  sub: string; // userId
  tid: string; // tenantId
}

const server = Server.configure({
  port: config.port,
  extensions: [new Redis({ host: redisHost(config.redisUrl), port: redisPort(config.redisUrl) })],

  async onAuthenticate({ token }) {
    let claims: TokenClaims;
    try {
      claims = jwt.verify(token, config.appSecret) as TokenClaims;
    } catch {
      throw new Error('Unauthorized');
    }
    // Exposed to later hooks via `context`.
    return { userId: claims.sub, tenantId: claims.tid };
  },

  // Debounced by Hocuspocus (see `debounce`) so an edit storm collapses to one persist (§8.7).
  async onStoreDocument({ documentName, document, context }) {
    const ctx = context as { tenantId?: string } | undefined;
    const tenantId = ctx?.tenantId;
    if (!tenantId) return;

    const blocks = yDocToBlocks(document);
    try {
      const res = await fetch(`${config.serverInternalUrl}/api/internal/sync/${documentName}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': config.appSecret },
        body: JSON.stringify({ tenantId, doc: blocks }),
      });
      if (!res.ok) {
        console.error(`sync callback failed for ${documentName}: ${res.status}`);
      }
    } catch (err) {
      console.error(`sync callback error for ${documentName}: ${(err as Error).message}`);
    }
  },

  // Wait for the doc to settle before projecting (§8.7 "after a Yjs document settles").
  debounce: config.persistDebounceMs,
});

function redisHost(url: string): string {
  try {
    return new URL(url).hostname || 'localhost';
  } catch {
    return 'localhost';
  }
}
function redisPort(url: string): number {
  try {
    return Number(new URL(url).port || 6379);
  } catch {
    return 6379;
  }
}

void server.listen();
console.log(`Zettra collab server listening on :${config.port}`);
