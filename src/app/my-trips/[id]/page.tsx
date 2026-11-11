import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount, userDatabase } from "@/lib/auth/session";
import { readSavedTrip } from "@/features/trips/read";
import { TripSummary } from "@/features/trips/summary";

export default async function TripPage({ params }: PageProps<"/my-trips/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const identity = await requireAccount(`/my-trips/${id}`);
  const saved = await userDatabase(identity, tx => readSavedTrip(tx, id), { isolationLevel: "RepeatableRead" });
  if (!saved) notFound();
  return <><nav className="trip-actions"><Link className="text-link" href="/my-trips">← My trips</Link><Link className="text-link" href={`/my-trips/${id}/edit`}>Edit itinerary</Link><Link className="trip-print-link" prefetch={false} href={`/my-trips/${id}/print`}>Print / Save as PDF</Link></nav><TripSummary saved={saved} /></>;
}
