import type { SessionUser } from "@/common/permissions/permissions";

declare module "next-auth" {
  interface Session {
    user: SessionUser & { name?: string | null; image?: string | null };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionUser?: SessionUser;
    refreshedAt?: number;
  }
}

export {};
