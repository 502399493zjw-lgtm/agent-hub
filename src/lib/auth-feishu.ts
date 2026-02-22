/**
 * Feishu (Lark) OAuth Provider for NextAuth v5
 *
 * Feishu OAuth is NOT standard OIDC:
 * - Uses app_id instead of client_id on authorize URL
 * - No scope parameter
 * - Token exchange requires app_access_token (not client credentials)
 * - User info endpoint uses user_access_token Bearer auth
 *
 * We use customFetch to intercept the token exchange request and
 * replace NextAuth's standard OAuth2 flow with Feishu's custom flow.
 */
import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers';
import { customFetch } from '@auth/core';

interface FeishuProfile {
  sub: string;
  name: string;
  picture: string;
  en_name: string;
  tenant_key: string;
  email?: string;
  mobile?: string;
  user_id?: string;
  union_id?: string;
}

export default function Feishu(
  config: OAuthUserConfig<FeishuProfile> & {
    appId: string;
    appSecret: string;
  }
): OAuthConfig<FeishuProfile> {
  const { appId, appSecret } = config;
  const callbackUrl = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || '') + '/api/auth/callback/feishu';

  // Custom fetch to intercept token exchange and userinfo requests
  async function feishuFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    console.log('[feishu-oauth] customFetch intercepting:', url);

    // Intercept token exchange request
    if (url.includes('/authen/v1/oidc/access_token')) {
      // Extract the authorization code from the original request body
      const body = init?.body;
      let code = '';
      if (body instanceof URLSearchParams) {
        code = body.get('code') || '';
      } else if (typeof body === 'string') {
        const params = new URLSearchParams(body);
        code = params.get('code') || '';
      }

      // Step 1: Get app_access_token
      const appTokenRes = await fetch(
        'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        }
      );
      const appTokenData = await appTokenRes.json() as { code: number; msg: string; app_access_token: string };
      if (appTokenData.code !== 0) {
        return new Response(JSON.stringify({ error: 'server_error', error_description: appTokenData.msg }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Exchange code for user_access_token using Feishu's API
      const tokenRes = await fetch(
        'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${appTokenData.app_access_token}`,
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
          }),
        }
      );
      const tokenData = await tokenRes.json() as {
        code: number;
        msg: string;
        data: {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          token_type: string;
        };
      };
      if (tokenData.code !== 0) {
        return new Response(JSON.stringify({ error: 'server_error', error_description: tokenData.msg }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Return standard OAuth2 token response that NextAuth expects
      const tokenResponse = {
        access_token: tokenData.data.access_token,
        refresh_token: tokenData.data.refresh_token,
        expires_in: tokenData.data.expires_in || 7200,
        token_type: 'Bearer',
      };
      console.log('[feishu-oauth] token exchange success, returning:', JSON.stringify(tokenResponse));
      return new Response(JSON.stringify(tokenResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Intercept userinfo request
    if (url.includes('/authen/v1/user_info')) {
      console.log('[feishu-oauth] userinfo request, headers:', JSON.stringify(init?.headers));
      // Forward with the correct auth header (NextAuth might send Basic auth)
      const headers = new Headers(init?.headers);
      const authHeader = headers.get('Authorization') || '';
      console.log('[feishu-oauth] auth header for userinfo:', authHeader);
      let accessToken = '';
      if (authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.slice(7);
      } else if (authHeader.startsWith('DPoP ')) {
        accessToken = authHeader.slice(5);
      }
      console.log('[feishu-oauth] extracted access_token:', accessToken.substring(0, 20) + '...');

      const res = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json() as {
        code: number;
        msg: string;
        data: {
          sub: string;
          name: string;
          picture: string;
          en_name: string;
          tenant_key: string;
          email?: string;
          mobile?: string;
          user_id?: string;
          union_id?: string;
        };
      };
      if (data.code !== 0) {
        console.error('[feishu-oauth] userinfo error:', JSON.stringify(data));
        return new Response(JSON.stringify({ error: data.msg }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Feishu userinfo often returns empty picture; fetch avatar from Contact API
      let avatarUrl = data.data.picture || '';
      if (!avatarUrl && data.data.union_id) {
        try {
          // Get app_access_token for Contact API (user token doesn't have permission)
          const appTokenRes = await fetch(
            'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
            }
          );
          const appTokenData = await appTokenRes.json() as { code: number; app_access_token: string };
          if (appTokenData.code === 0) {
            const contactRes = await fetch(
              `https://open.feishu.cn/open-apis/contact/v3/users/${data.data.union_id}?user_id_type=union_id`,
              { headers: { Authorization: `Bearer ${appTokenData.app_access_token}` } }
            );
            const contactData = await contactRes.json() as {
              code: number;
              data?: { user?: { avatar?: { avatar_240?: string; avatar_640?: string; avatar_origin?: string } } };
            };
            if (contactData.code === 0 && contactData.data?.user?.avatar) {
              avatarUrl = contactData.data.user.avatar.avatar_640
                || contactData.data.user.avatar.avatar_240
                || contactData.data.user.avatar.avatar_origin
                || '';
            }
            console.log('[feishu-oauth] fetched avatar from Contact API:', avatarUrl.substring(0, 60));
          }
        } catch (e) {
          console.warn('[feishu-oauth] failed to fetch avatar from Contact API:', e);
        }
      }

      // Return user profile in OIDC-compatible format
      const userProfile = {
        sub: data.data.sub || data.data.user_id || data.data.union_id || '',
        name: data.data.name || data.data.en_name || '飞书用户',
        email: data.data.email || undefined,
        picture: avatarUrl,
        en_name: data.data.en_name,
        tenant_key: data.data.tenant_key,
        user_id: data.data.user_id,
        union_id: data.data.union_id,
      };
      console.log('[feishu-oauth] returning userProfile:', JSON.stringify(userProfile));
      return new Response(JSON.stringify(userProfile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: pass through
    return fetch(input, init);
  }

  return {
    id: 'feishu',
    name: '飞书',
    type: 'oauth',
    clientId: appId,
    clientSecret: appSecret,

    // Use customFetch to intercept all OAuth HTTP requests
    [customFetch]: feishuFetch,

    authorization: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/authorize',
      params: {
        app_id: appId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: '',
      },
    },

    token: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
    },

    userinfo: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
    },

    profile(profile: FeishuProfile) {
      console.log('[feishu-oauth] profile() called with:', JSON.stringify(profile));
      const result = {
        id: profile.sub || profile.user_id || profile.union_id || '',
        name: profile.name || profile.en_name || '飞书用户',
        email: profile.email || undefined,
        image: profile.picture || '',
      };
      console.log('[feishu-oauth] profile() returning:', JSON.stringify(result));
      return result;
    },

    style: {
      text: '#1a1a1a',
      bg: '#3370ff',
      logo: 'https://sf3-scmcdn2-cn.feishucdn.com/ccm/pc/web/resource/bear/src/common/favicon.ico',
    },

    checks: ['state'],
  } as OAuthConfig<FeishuProfile>;
}
