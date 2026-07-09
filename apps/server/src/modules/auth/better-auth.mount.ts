import type { FastifyInstance } from 'fastify';
import { getAuth } from './better-auth';

/**
 * Mount Better Auth's HTTP handler at `/api/auth/*` on the app's Fastify instance. Registered as
 * an encapsulated plugin so its raw-body passthrough (Better Auth reads the raw request stream)
 * applies ONLY to the auth routes — NestJS keeps its JSON body parsing everywhere else.
 *
 * Only called when AUTH_PROVIDER=better-auth, so the default boot path is untouched. Needs live
 * verification against a database + configured OAuth credentials (see docs/AUTH.md).
 */
export async function mountBetterAuth(fastify: FastifyInstance): Promise<void> {
  const auth = await getAuth();
  const { toNodeHandler } = await import('better-auth/node');
  const handler = toNodeHandler(auth);

  await fastify.register(async (instance) => {
    instance.addContentTypeParser('application/json', (_req, _payload, done) => done(null, null));
    instance.all('/api/auth/*', async (request, reply) => {
      reply.hijack();
      await handler(request.raw, reply.raw);
    });
  });
}
