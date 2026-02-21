import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import {
  findUserByProvider, findUserByEmail, createUser, findUserById,
  isOnboardingCompleted, updateProviderInfo,
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
      onboardingCompleted: boolean;
    };
  }
}

function generateUserId(): string {
  return 'u-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: minimalAdapter,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Manually specify endpoints to avoid OIDC discovery
      // (ECS in China cannot reach accounts.google.com for .well-known/openid-configuration)
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: { scope: "openid email profile" },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
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
    async signIn({ user, account }) {
      if (!account) return false;

      const provider = account.provider;
      const providerId = account.providerAccountId;

      // Email provider: user is created by adapter, just check soft-delete
      if (provider === 'resend') {
        const existing = findUserByEmail(user.email ?? '');
        if (existing?.deleted_at) return false;
        return true;
      }

      // OAuth providers
      const existing = findUserByProvider(provider, providerId);
      if (existing) {
        if (existing.deleted_at) return false;
        updateProviderInfo(existing.id, user.name ?? existing.name, user.image ?? existing.avatar);
        return true;
      }

      createUser({
        id: generateUserId(),
        email: user.email ?? null,
        name: user.name ?? 'Anonymous',
        avatar: user.image ?? '',
        provider,
        providerId,
      });

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
        session.user.onboardingCompleted = !!dbUser.onboarding_completed;
      }

      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
});
