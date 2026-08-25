// next-auth configuration (ADR-0003).
// NOTE: next-auth v4 Credentials provider requires JWT strategy (DB sessions unsupported with Credentials).
// We use JWT strategy BUT validate each session against the DB on every request (session callback),
// so sessions remain revocable (delete the Session row -> next request fails) and auditable.
// This is a hybrid: JWT for transport + DB row for revocation/audit. ADR-0003 documents this trade-off.
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "./db";
import { verifyPassword } from "./auth.password";
import { isLocked, shouldLock, nextLockUntil } from "./auth.lockout";
import { audit } from "./audit";
import { randomBytes } from "node:crypto";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        const reqHeaders = (req as { headers?: Record<string, string | string[]> } | undefined)?.headers ?? {};
        const xff = reqHeaders["x-forwarded-for"];
        const xri = reqHeaders["x-real-ip"];
        const ipAddress = (Array.isArray(xff) ? xff[0] : xff) ?? (Array.isArray(xri) ? xri[0] : xri) ?? null;
        const ua = reqHeaders["user-agent"];
        const userAgent = (Array.isArray(ua) ? ua[0] : ua) ?? null;

        if (!email || !password) {
          await audit({ action: "identity.session.signin", entityType: "User", entityId: email ?? "unknown", outcome: "FAILURE", reason: "Missing email or password", ipAddress, userAgent });
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          await audit({ action: "identity.session.signin", entityType: "User", entityId: email, outcome: "FAILURE", reason: "Unknown user", ipAddress, userAgent });
          return null;
        }
        if (user.status === "DISABLED") {
          await audit({ actorUserId: user.id, action: "identity.session.signin", entityType: "User", entityId: user.id, outcome: "DENIED", reason: "Account disabled", ipAddress, userAgent });
          return null;
        }
        if (isLocked(user.lockedUntil)) {
          await audit({ actorUserId: user.id, action: "identity.session.signin", entityType: "User", entityId: user.id, outcome: "DENIED", reason: "Account locked", ipAddress, userAgent });
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const failedAttempts = user.failedAttempts + 1;
          const lockUpdate = shouldLock(failedAttempts) && !user.lockedUntil ? { failedAttempts, lockedUntil: nextLockUntil() } : { failedAttempts };
          await db.user.update({ where: { id: user.id }, data: lockUpdate });
          await audit({ actorUserId: user.id, action: "identity.session.signin", entityType: "User", entityId: user.id, outcome: "FAILURE", reason: `Invalid password (attempt ${failedAttempts})`, ipAddress, userAgent });
          return null;
        }

        // Success: reset lockout, record sign-in, create a revocable Session row.
        await db.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastSignInAt: new Date() } });
        const sessionToken = randomBytes(32).toString("hex");
        const session = await db.session.create({
          data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 8 * 60 * 60 * 1000) },
        });
        await audit({ actorUserId: user.id, action: "identity.session.signin", entityType: "Session", entityId: session.id, outcome: "SUCCESS", sessionId: sessionToken, ipAddress, userAgent });
        // Return user + the session token so the JWT callback can store it.
        return { id: user.id, email: user.email, name: user.name ?? undefined, sessionToken } as unknown as { id: string; email: string; name?: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, attach userId + sessionToken to the token.
      if (user) {
        token.uid = (user as { id: string }).id;
        token.sessionToken = (user as { sessionToken?: string }).sessionToken;
      }
      return token;
    },
    async session({ session, token }) {
      // Validate the session against the DB on EVERY request (revocation + audit link).
      // This is the hybrid: JWT transport + DB row for revocability (ADR-0003).
      const sessionToken = token.sessionToken as string | undefined;
      const userId = token.uid as string | undefined;
      if (!sessionToken || !userId) {
        return { ...session, user: {} } as typeof session;
      }
      const dbSession = await db.session.findUnique({ where: { sessionToken } });
      if (!dbSession || dbSession.expires < new Date() || dbSession.userId !== userId) {
        // Session revoked or expired: return an empty session (client treats as unauthenticated).
        return { ...session, user: {} } as typeof session;
      }
      const u = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, preferredLocale: true, status: true },
      });
      if (!u || u.status !== "ACTIVE") {
        return { ...session, user: {} } as typeof session;
      }
      (session.user as { id?: string }).id = u.id;
      (session.user as { email?: string }).email = u.email;
      (session.user as { name?: string }).name = u.name ?? undefined;
      (session.user as { preferredLocale?: string }).preferredLocale = u.preferredLocale;
      return session;
    },
  },
  events: {
    async signOut(message) {
      // Delete the Session row on sign-out (revocation).
      const token = (message as { token?: { sessionToken?: string } }).token;
      if (token?.sessionToken) {
        try {
          await db.session.deleteMany({ where: { sessionToken: token.sessionToken } });
        } catch {
          // ignore
        }
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
