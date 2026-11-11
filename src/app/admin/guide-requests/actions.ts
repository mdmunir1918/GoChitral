"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { decideGuideRequest } from "@/features/guides/requests";

const commandSchema = z.object({ id: z.uuid(), decision: z.enum(["confirmed", "declined"]), reason: z.string().trim().min(1).max(1000) });
export async function decide(form: FormData) {
  if ((await headers()).get("origin") !== process.env.APP_ORIGIN) redirect("/admin/guide-requests?result=error");
  const identity = await requireRole("administrator", "/admin/guide-requests");
  if (!identity) redirect("/admin/guide-requests?result=denied");
  const command = commandSchema.safeParse(Object.fromEntries(form));
  if (!command.success) redirect("/admin/guide-requests?result=invalid");
  let changed: boolean;
  try { changed = await userDatabase(identity, tx => decideGuideRequest(tx, command.data.id, command.data.decision, command.data.reason)); }
  catch { redirect("/admin/guide-requests?result=overlap"); }
  redirect(`/admin/guide-requests?result=${changed ? command.data.decision : "stale"}`);
}
