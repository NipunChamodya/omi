import * as oidc from 'openid-client';
import { z } from 'zod';
export type LoginTransaction = {
  state: string;
  nonce: string;
  verifier: string;
};
export type GoogleIdentity = {
  sub: string;
  name: string;
  picture: string | null;
};
export interface IdentityProvider {
  authorization(transaction: LoginTransaction): Promise<string>;
  exchange(url: URL, transaction: LoginTransaction): Promise<GoogleIdentity>;
}
export function safeGooglePicture(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'googleusercontent.com' ||
        url.hostname.endsWith('.googleusercontent.com')) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export class GoogleOidc implements IdentityProvider {
  private configuration: Promise<oidc.Configuration> | undefined;
  constructor(
    private readonly clientId: string,
    private readonly secret: string,
    private readonly callback: string,
    private readonly issuer = new URL('https://accounts.google.com'),
    private readonly testHttp = false,
  ) {}
  private config() {
    // HTTP is injectable only by local test fixtures, never a production environment switch.
    return (this.configuration ??= oidc
      .discovery(this.issuer, this.clientId, this.secret, undefined, {
        timeout: 10,
        ...(this.testHttp ? { execute: [oidc.allowInsecureRequests] } : {}),
      })
      .then((config) => {
        oidc.enableNonRepudiationChecks(config);
        return config;
      })
      .catch((error: unknown) => {
        this.configuration = undefined;
        throw error;
      }));
  }
  async authorization(transaction: LoginTransaction) {
    const config = await this.config();
    config.timeout = 10;
    return oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.callback,
      scope: 'openid profile',
      state: transaction.state,
      nonce: transaction.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(
        transaction.verifier,
      ),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).href;
  }
  async exchange(
    url: URL,
    transaction: LoginTransaction,
  ): Promise<GoogleIdentity> {
    const config = await this.config();
    config.timeout = 10;
    const tokens = await oidc.authorizationCodeGrant(config, url, {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.verifier,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    const sub = z.string().min(1).max(255).parse(claims?.sub);
    const profile = await oidc.fetchUserInfo(config, tokens.access_token, sub);
    const raw = typeof profile.name === 'string' ? profile.name : 'OMI player';
    const name =
      Array.from(raw.replace(/\p{Cc}/gu, '').trim()).reduce(
        (result, char) =>
          result.length + char.length <= 32 ? result + char : result,
        '',
      ) || 'OMI player';
    return { sub, name, picture: safeGooglePicture(profile.picture) };
  }
}
