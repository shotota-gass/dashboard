import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as { userId?: string }).userId;
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId as string;
      session.user.role = token.role as string;
      session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
