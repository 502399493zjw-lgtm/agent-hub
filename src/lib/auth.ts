import crypto from 'crypto';
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
// Google OAuth removed (ECS in China cannot reach Google servers)
import Resend from 'next-auth/providers/resend';
import Feishu from '@/lib/auth-feishu';
import { cookies } from 'next/headers';
import {
  findUserByProvider, findUserByEmail, createUser, findUserById,
  updateProviderInfo, activateInviteCode, validateInviteCode,
  createVerificationToken, useVerificationToken,
  generateLetterAvatar,
  type DbUser,
} from '@/lib/db';
import { peekQualificationToken, approveCliAuthByDevice, consumePendingEmailInvite, peekPendingEmailInvite, listAuthorizedDevices } from '@/lib/db/auth';
import type { Adapter } from 'next-auth/adapters';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image: string;
      provider: string;
      inviteCode: string | null;
      isNewUser?: boolean;
    };
  }
}

function generateUserId(): string {
  return 'u-' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
}

// Minimal adapter: only implements what Email/Magic Link provider needs
// (verification tokens + user lookup by email)
function toAdapterUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name,
    image: user.avatar,
    emailVerified: null,
  };
}

const minimalAdapter: Adapter = {
  createUser: async (data) => {
    console.log('[auth/adapter] createUser called:', { email: data.email, name: data.name });
    const id = generateUserId();
    const user = createUser({
      id,
      email: data.email ?? null,
      name: data.name ?? data.email?.split('@')[0] ?? 'Anonymous',
      avatar: data.image ?? '',
      provider: 'resend',
      providerId: data.email ?? id,
    });
    // Auto-activate invite code for new email user
    // Try cookie first, then server-side stash (for cross-browser magic link)
    // Fallback to SEAFOOD so every new user gets an invite code on record
    const inviteCode = await getInviteCodeFromCookie()
      || (data.email ? consumePendingEmailInvite(data.email) : null)
      || 'SEAFOOD';
    activateInviteCode(id, inviteCode);
    return toAdapterUser(user);
  },
  getUserByEmail: async (email) => {
    const user = findUserByEmail(email);
    return user ? toAdapterUser(user) : null;
  },
  getUserByAccount: async ({ provider, providerAccountId }) => {
    const user = findUserByProvider(provider, providerAccountId);
    return user ? toAdapterUser(user) : null;
  },
  getUser: async (id) => {
    const user = findUserById(id);
    return user ? toAdapterUser(user) : null;
  },
  updateUser: async (data) => {
    return { id: data.id!, email: data.email ?? '', name: data.name ?? '', image: data.image ?? '', emailVerified: null };
  },
  linkAccount: async () => undefined,
  createVerificationToken: async (data) => {
    console.log('[auth/adapter] createVerificationToken:', { identifier: data.identifier, tokenLen: data.token?.length, expires: data.expires });
    return createVerificationToken(data);
  },
  useVerificationToken: async (data) => {
    console.log('[auth/adapter] useVerificationToken:', { identifier: data.identifier, tokenLen: data.token?.length });
    const result = useVerificationToken(data);
    console.log('[auth/adapter] useVerificationToken result:', result ? { found: true, expires: result.expires } : { found: false });
    return result;
  },
  createSession: async () => ({ sessionToken: '', userId: '', expires: new Date() }),
  getSessionAndUser: async () => null,
  updateSession: async () => null,
  deleteSession: async () => {},
  deleteUser: async () => {},
  unlinkAccount: async () => {},
};

/**
 * Read the invite_code cookie set by the login page.
 * Returns the code string or null.
 */
async function getInviteCodeFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('invite_code');
    return cookie?.value ? decodeURIComponent(cookie.value).trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Try to auto-activate invite code for a user if they don't have one yet.
 */
function tryAutoActivateInvite(userId: string, code: string | null): void {
  if (!code) return;
  const user = findUserById(userId);
  if (!user || user.invite_code) return; // already activated or user not found
  activateInviteCode(userId, code);
}

/**
 * Read the qualification_token cookie set by the redirect route.
 * If valid, returns the device_id (if any) to auto-approve CLI auth.
 */
async function getQualificationDeviceId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('qualification_token');
    if (!cookie?.value) return null;
    const peek = peekQualificationToken(cookie.value);
    return peek.valid && peek.deviceId ? peek.deviceId : null;
  } catch {
    return null;
  }
}

/**
 * Auto-approve pending CLI auth request for a device after successful OAuth sign-in.
 */
function tryAutoApproveCliAuth(userId: string, deviceId: string | null): void {
  if (!deviceId) return;
  try {
    const result = approveCliAuthByDevice(deviceId, userId);
    if (result.success) {
      console.log(`[auth] Auto-approved CLI auth for device ${deviceId.slice(0, 12)}... user ${userId}`);
    }
  } catch (e) {
    console.error('[auth] Auto-approve CLI auth error:', e);
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: minimalAdapter,
  providers: [
    {
      // GitHub provider with token exchange routed through Cloudflare Worker
      // to bypass China ECS → github.com connectivity issues
      ...GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
      token: 'https://github-oauth.openclawmp.cc/login/oauth/access_token',
      // Force client_secret_post: send credentials in body instead of
      // Authorization: Basic header. The Worker proxy doesn't forward
      // auth headers, causing GitHub to return 404 with Basic auth.
      client: { token_endpoint_auth_method: 'client_secret_post' },
    },
    // Google OAuth removed — ECS in China cannot reach Google servers
    // Feishu OAuth — UI entry removed (self-built app can't cross tenants)
    // Backend kept so existing feishu users (Commander) can still sign in
    Feishu({
      appId: process.env.AUTH_FEISHU_APP_ID || '',
      appSecret: process.env.AUTH_FEISHU_APP_SECRET || '',
      clientId: process.env.AUTH_FEISHU_APP_ID || '',
      clientSecret: process.env.AUTH_FEISHU_APP_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM || 'noreply@openclawmp.cc',
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/login?verify=true',
    newUser: '/settings?section=devices&welcome=1',
  },
  callbacks: {
        async signIn({ user, account, profile: oauthProfile }) {
      if (!account) return false;

      const provider = account.provider;
      const providerId = account.providerAccountId;

      // Read invite code from cookie (set during register page step 1)
      let inviteCode = await getInviteCodeFromCookie();
      // Read qualification_token cookie to auto-approve CLI auth
      const qualifyDeviceId = await getQualificationDeviceId();

      // Email provider: signIn callback is called TWICE in the magic-link flow:
      //   1st call: before sendVerificationRequest (pre-check) — must return true to allow email sending
      //   2nd call: after user clicks the link (actual sign-in) — user.id is set by adapter
      // We detect which phase by checking if the user has a DB id already.
      if (provider === 'resend') {
        console.log('[auth] signIn resend callback:', { email: user.email, userId: user.id });
        const existing = findUserByEmail(user.email ?? '');
        if (existing?.deleted_at) {
          console.log('[auth] signIn resend: user deleted, rejecting');
          return false;
        }
        if (existing) {
          // Existing user → allow login, auto-activate invite if they have one
          console.log('[auth] signIn resend: existing user', existing.id);
          const effectiveInviteCode = inviteCode || (user.email ? consumePendingEmailInvite(user.email) : null);
          tryAutoActivateInvite(existing.id, effectiveInviteCode);
          tryAutoApproveCliAuth(existing.id, qualifyDeviceId);
          return true;
        }
        // New user — 1st call (pre-check before sending email): user not in DB yet
        // Must return true so NextAuth proceeds to send the verification email.
        // The adapter's createUser will be called after the user clicks the link.
        // Invite code validation happens in the adapter's createUser.
        console.log('[auth] signIn resend: new user, allowing email send');
        return true;
      }

      // OAuth providers
      const existing = findUserByProvider(provider, providerId);
      if (existing) {
        if (existing.deleted_at) return false;
        // user.image may be stale (from DB); prefer fresh avatar from OAuth profile
        const freshAvatar = (oauthProfile as Record<string, unknown>)?.picture as string
          || (oauthProfile as Record<string, unknown>)?.image as string
          || user.image || existing.avatar;
        console.log('[auth] signIn existing user, freshAvatar:', freshAvatar?.substring(0, 60));
        updateProviderInfo(existing.id, user.name ?? existing.name, freshAvatar);
        // Existing user → allow login, auto-activate invite if they have one
        tryAutoActivateInvite(existing.id, inviteCode);
        tryAutoApproveCliAuth(existing.id, qualifyDeviceId);
        return true;
      }

      // New user via OAuth → auto-create account (open registration)
      // If invite code provided and valid, activate it; otherwise just create without invite
      if (inviteCode) {
        const validation = validateInviteCode(inviteCode);
        if (!validation.valid) {
          // Bad invite code → still create user, just skip activation
          console.log('[auth] signIn: invalid invite code, creating user without invite');
          inviteCode = '';
        }
      }

      const newUserId = generateUserId();
      const newAvatar = (oauthProfile as Record<string, unknown>)?.picture as string
        || (oauthProfile as Record<string, unknown>)?.image as string
        || user.image || '';
      createUser({
        id: newUserId,
        email: user.email ?? null,
        name: user.name ?? 'Anonymous',
        avatar: newAvatar,
        provider,
        providerId,
      });

      // Activate invite code for new user (if provided, else default SEAFOOD)
      if (!inviteCode) inviteCode = 'SEAFOOD';
      activateInviteCode(newUserId, inviteCode);

      // Auto-approve CLI auth if qualify flow created one
      tryAutoApproveCliAuth(newUserId, qualifyDeviceId);

      // New user → redirect to device binding page (override callbackUrl)
      return '/settings?section=devices&welcome=1';
    },

    async jwt({ token, user, account }) {
      if (account) {
        token.provider = account.provider;
        token.providerId = account.providerAccountId;

        // For email login, look up by email; for OAuth, by provider
        let dbUser: DbUser | null = null;
        if (account.provider === 'resend' && user?.email) {
          dbUser = findUserByEmail(user.email);
        } else {
          dbUser = findUserByProvider(account.provider, account.providerAccountId);
        }
        if (dbUser) {
          token.dbUserId = dbUser.id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      let dbUser: DbUser | null = null;
      if (token.dbUserId) {
        dbUser = findUserById(token.dbUserId as string);
      }
      if (!dbUser && token.provider && token.providerId) {
        dbUser = findUserByProvider(token.provider as string, token.providerId as string);
        // Fallback: old email users stored provider='email' but NextAuth uses 'resend'
        if (!dbUser && token.provider === 'resend') {
          dbUser = findUserByProvider('email', token.providerId as string);
        }
      }
      // Fallback: look up by email for email-based login
      if (!dbUser && session.user.email) {
        dbUser = findUserByEmail(session.user.email);
      }

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.name = dbUser.name;
        session.user.email = dbUser.email ?? '';
        session.user.image = dbUser.avatar;
        session.user.provider = dbUser.provider;
        session.user.inviteCode = dbUser.invite_code;
        // isNewUser no longer needed — redirect is handled in signIn callback directly
      } else {
        // User not found in DB (data loss / deleted) → invalidate session
        // Frontend SessionProvider will detect unauthenticated and show login state
        console.log('[auth] session: dbUser not found, invalidating session. provider:', token.provider, 'providerId:', token.providerId);
        return { ...session, user: undefined as unknown as typeof session.user, expires: new Date(0).toISOString() };
      }

      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // M05: 7-day session expiration
  },
  trustHost: true,
  // Fix PKCE cookie issue behind Cloudflare Tunnel (HTTPS→HTTP proxy).
  // Without this, NextAuth uses __Secure- prefixed cookies which require
  // the origin request to be HTTPS, but the container sees HTTP from the tunnel.
  // In local dev (http://localhost), secure must be false or cookies won't be set.
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    nonce: {
      name: 'next-auth.nonce',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
