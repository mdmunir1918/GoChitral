import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export function authDatabase<T>(action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_auth`;
    return action(tx);
  });
}
