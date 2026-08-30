import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import {
  authorizeCredentialsLogin,
  type CredentialsLoginReport,
} from "./credentials-login";
import { createPrismaCredentialsLoginDatabase } from "./credentials-login-database";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  resolveAuthSecret,
  resolveVerifiedLoginGraceDeadline,
  resolveVerifiedLoginPolicy,
  shouldUseSecureAuthCookies,
} from "./config";

const verifiedLoginPolicy = resolveVerifiedLoginPolicy();
const verifiedLoginGraceDeadline = resolveVerifiedLoginGraceDeadline(
  verifiedLoginPolicy,
);
const credentialsLoginDatabase = createPrismaCredentialsLoginDatabase(prisma);

function reportCredentialsLogin(event: CredentialsLoginReport): void {
  // This event type deliberately cannot carry user identifiers, submitted
  // credentials, hashes or raw exceptions.
  if (event.reason === "AUDIT_WOULD_DENY") {
    console.warn("Verified-login audit decision", event);
    return;
  }
  console.error("Credentials login internal failure", event);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Every expected denial returns null so NextAuth emits the same public
        // CredentialsSignin outcome without reflecting internal error text.
        return authorizeCredentialsLogin(credentials, {
          policy: verifiedLoginPolicy,
          stagedGraceDeadline: verifiedLoginGraceDeadline,
          ...credentialsLoginDatabase,
          report: reportCredentialsLogin,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.requiresEmailVerification = user.requiresEmailVerification;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.requiresEmailVerification =
          token.requiresEmailVerification === true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  },
  useSecureCookies: shouldUseSecureAuthCookies(),
  secret: resolveAuthSecret(),
};

// Type extensions for NextAuth
declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    requiresEmailVerification: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      firstName: string;
      lastName: string;
      requiresEmailVerification: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    requiresEmailVerification?: boolean;
  }
}
