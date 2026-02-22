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
  type DbUser,
} from '@/lib/db';
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
    const id = generateUserId();
    const user = createUser({
      id,
      email: data.email ?? null,
      name: data.name ?? data.email?.split('@')[0] ?? 'Anonymous',
      avatar: data.image ?? '',
      provider: 'email',
      providerId: data.email ?? id,
    });
    // Auto-activate invite code for new email user (cookie was validated in signIn callback)
    const inviteCode = await getInviteCodeFromCookie();
    if (inviteCode) {
      activateInviteCode(id, inviteCode);
    }
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
    return createVerificationToken(data);
  },
  useVerificationToken: async (data) => {
    return useVerificationToken(data);
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: minimalAdapter,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    // Google OAuth removed — ECS in China cannot reach Google servers
    Feishu({
      appId: process.env.AUTH_FEISHU_APP_ID || '',
      appSecret: process.env.AUTH_FEISHU_APP_SECRET || '',
      clientId: process.env.AUTH_FEISHU_APP_ID || '',
      clientSecret: process.env.AUTH_FEISHU_APP_SECRET || '',
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM || 'noreply@openclawmp.cc',
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=true',
  },
  callbacks: {
        async signIn({ user, account, profile: oauthProfile }) {
      if (!account) return false;

      const provider = account.provider;
      const providerId = account.providerAccountId;

      // Read invite code from cookie (set during register page step 1)
      const inviteCode = await getInviteCodeFromCookie();

      // Email provider: user is created by adapter, just check soft-delete + auto-activate
      if (provider === 'resend') {
        const existing = findUserByEmail(user.email ?? '');
        if (existing?.deleted_at) return false;
        if (existing) {
          // Existing user → allow login, auto-activate invite if they have one
          tryAutoActivateInvite(existing.id, inviteCode);
          return true;
        }
        // New user via email → must come through register flow with invite code
        if (!inviteCode) return '/login?error=not_registered';
        const validation = validateInviteCode(inviteCode);
        if (!validation.valid) return '/register?error=invite_required';
        // User will be created by the adapter's createUser; we'll activate invite in jwt callback
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
        return true;
      }

      // New user via OAuth → must come through register flow with invite code
      if (!inviteCode) return '/login?error=not_registered';
      const validation = validateInviteCode(inviteCode);
      if (!validation.valid) return '/register?error=invite_required';

      // New user registration with valid invite code
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

      // Activate invite code for new user
      activateInviteCode(newUserId, inviteCode);

      return true;
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
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none' as const,
        path: '/',
        secure: true,
      },
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
      },
    },
    nonce: {
      name: 'next-auth.nonce',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
      },
    },
  },
});
