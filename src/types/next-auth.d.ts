import "next-auth";
import "next-auth/jwt";
import type { AccountRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User { sid?: string; accountRole?: AccountRole }
  interface Session { sid: string; aal: "aal1" | "aal2"; accountRole?: AccountRole }
}
declare module "next-auth/jwt" {
  interface JWT { sid?: string; aal?: "aal1" | "aal2"; accountRole?: AccountRole }
}
