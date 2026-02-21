import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { findUserByProvider, createUser, findUserById, type DbUser } from '@/lib/db';

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
  return 'u-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false;

      const provider = account.provider;
      const providerId = account.providerAccountId;

      // Check if user exists
      const existing = findUserByProvider(provider, providerId);
      if (existing) {
        // Soft-deleted users cannot log in
        if (existing.deleted_at) {
          return false;
        }
        return true;
      }

      // Create new user
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

    async jwt({ token, account }) {
      if (account) {
        // On initial sign-in, store provider info in token
        token.provider = account.provider;
        token.providerId = account.providerAccountId;

        // Find the DB user and store their ID
        const dbUser = findUserByProvider(account.provider, account.providerAccountId);
        if (dbUser) {
          token.dbUserId = dbUser.id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Look up current user from DB
      let dbUser: DbUser | null = null;
      if (token.dbUserId) {
        dbUser = findUserById(token.dbUserId as string);
      }
      if (!dbUser && token.provider && token.providerId) {
        dbUser = findUserByProvider(token.provider as string, token.providerId as string);
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
  },
  trustHost: true,
});
