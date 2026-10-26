/** Local test identity provider. Never imported by the production entry point. */
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import type { AvatarSize, AvatarStorage } from '../src/avatars/storage.js';
export class MemoryAvatars implements AvatarStorage {
  readonly objects = new Map<string, Buffer>();
  failPut = false;
  failDelete = false;
  async put(id: string, size: AvatarSize, bytes: Buffer) {
    if (this.failPut) throw new Error('Simulated store outage');
    this.objects.set(`${id}/${size}`, Buffer.from(bytes));
  }
  async get(id: string, size: AvatarSize) {
    const value = this.objects.get(`${id}/${size}`);
    if (!value) throw new Error('Missing object');
    return Buffer.from(value);
  }
  async remove(id: string) {
    if (this.failDelete) throw new Error('Simulated delete outage');
    this.objects.delete(`${id}/profile`);
    this.objects.delete(`${id}/thumbnail`);
  }
}
export async function mockOidc() {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    use: 'sig',
    alg: 'RS256',
  };
  const codes = new Map<
    string,
    { nonce: string; challenge: string; redirect: string; sub: string }
  >();
  const tokens = new Map<string, string>();
  let issuer = '';
  let fault = '';
  let nextUser = 0;
  app.get('/.well-known/openid-configuration', async () => ({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    userinfo_endpoint: `${issuer}/userinfo`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: [
      'client_secret_post',
      'client_secret_basic',
    ],
    code_challenge_methods_supported: ['S256'],
  }));
  app.get('/jwks', async () => ({ keys: [jwk] }));
  app.get('/authorize', async (request, reply) => {
    const params = new URL(request.url, issuer).searchParams;
    if (
      params.get('client_id') !== 'mock-client' ||
      params.get('code_challenge_method') !== 'S256'
    )
      return reply.code(400).send();
    const redirect = params.get('redirect_uri')!;
    if (
      redirect !== 'https://omi.example/auth/google/callback' &&
      !/^http:\/\/127\.0\.0\.1:\d+\/(?:api\/)?auth\/google\/callback$/.test(
        redirect,
      )
    )
      return reply.code(400).send();
    const sub = request.cookies.mock_subject ?? `mock-user-${++nextUser}`;
    reply.setCookie('mock_subject', sub, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    const code = randomUUID();
    codes.set(code, {
      nonce: params.get('nonce')!,
      challenge: params.get('code_challenge')!,
      redirect,
      sub,
    });
    const url = new URL(redirect);
    url.searchParams.set('code', code);
    url.searchParams.set('state', params.get('state')!);
    return reply.code(303).redirect(url.href);
  });
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) =>
      done(null, Object.fromEntries(new URLSearchParams(String(body)))),
  );
  app.post('/token', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const basic = Buffer.from(
      request.headers.authorization?.replace(/^Basic /, '') ?? '',
      'base64',
    ).toString();
    if (
      !(
        body.client_id === 'mock-client' && body.client_secret === 'mock-secret'
      ) &&
      basic !== 'mock-client:mock-secret'
    )
      return reply.code(401).send({ error: 'invalid_client' });
    const transaction = codes.get(body.code ?? '');
    codes.delete(body.code ?? '');
    if (
      !transaction ||
      transaction.redirect !== body.redirect_uri ||
      createHash('sha256')
        .update(body.code_verifier ?? '')
        .digest('base64url') !== transaction.challenge
    )
      return reply.code(400).send({ error: 'invalid_grant' });
    const now = Math.floor(Date.now() / 1000);
    const token = randomUUID();
    tokens.set(token, transaction.sub);
    const claims = {
      iss: fault === 'issuer' ? 'https://evil.example' : issuer,
      sub: transaction.sub,
      aud: fault === 'audience' ? 'wrong-client' : 'mock-client',
      iat: now,
      exp: fault === 'expired' ? now - 3600 : now + 300,
      nonce: fault === 'nonce' ? 'wrong-nonce' : transaction.nonce,
    };
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })}.${encode(claims)}`;
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(input),
      privateKey,
    ).toString('base64url');
    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 300,
      id_token: `${input}.${fault === 'signature' ? 'invalid' : signature}`,
    };
  });
  app.get('/userinfo', async (request, reply) => {
    const sub = tokens.get(
      request.headers.authorization?.replace(/^Bearer /, '') ?? '',
    );
    if (!sub) return reply.code(401).send();
    return {
      sub: fault === 'userinfo' ? 'different-sub' : sub,
      name: `Test ${sub}`,
      picture: null,
    };
  });
  issuer = await app.listen({ host: '127.0.0.1', port: 0 });
  return {
    app,
    url: issuer,
    setFault: (value: string) => {
      fault = value;
    },
  };
}
export async function mockS3() {
  const app = Fastify({ logger: false, bodyLimit: 300_000 });
  const objects = new Map<string, Buffer>();
  let writes = 0;
  app.addContentTypeParser(
    'image/webp',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );
  app.put('/*', async (request, reply) => {
    if (!request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 '))
      return reply.code(403).send();
    objects.set(
      request.url.split('?')[0]!,
      Buffer.from(request.body as Buffer),
    );
    writes++;
    return reply.header('ETag', '"test-object"').code(200).send();
  });
  app.get('/*', async (request, reply) => {
    const object = objects.get(request.url.split('?')[0]!);
    return object
      ? reply.type('image/webp').send(object)
      : reply.code(404).send();
  });
  app.delete('/*', async (request, reply) => {
    objects.delete(request.url.split('?')[0]!);
    return reply.code(204).send();
  });
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  return { app, url, objects, writes: () => writes };
}
