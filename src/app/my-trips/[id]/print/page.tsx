import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount, userDatabase } from "@/lib/auth/session";
import { readSavedTrip } from "@/features/trips/read";
import { TripSummary } from "@/features/trips/summary";
import { PrintButton } from "./print-button";

export const metadata = { title: "Print itinerary", robots: { index: false, follow: false } };
export default async function PrintTrip({ params }: PageProps<"/my-trips/[id]/print">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Authorize this export request independently of the normal detail page.
  const identity = await requireAccount(`/my-trips/${id}/print`);
  const saved = await userDatabase(identity, tx => readSavedTrip(tx, id), { isolationLevel: "RepeatableRead" });
  if (!saved) notFound();
  return <div className="trip-print"><nav className="trip-actions"><Link className="text-link" href={`/my-trips/${id}`}>← Saved itinerary</Link><PrintButton /></nav><TripSummary saved={saved} /></div>;
}
