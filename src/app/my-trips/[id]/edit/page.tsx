import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount, userDatabase } from "@/lib/auth/session";
import { readSavedTrip, tripDraft } from "@/features/trips/read";
import { Planner } from "@/app/plan/planner";
import "../../../plan/plan.css";

export default async function EditTrip({ params }: PageProps<"/my-trips/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const identity = await requireAccount(`/my-trips/${id}/edit`);
  const saved = await userDatabase(identity, tx => readSavedTrip(tx, id), { isolationLevel: "RepeatableRead" });
  if (!saved) notFound();
  return <section className="planner-page"><Link className="text-link" href={`/my-trips/${id}`}>← Saved itinerary</Link><h1>Edit your <em>trip.</em></h1><p>Your saved itinerary changes only after you save. Other tabs cannot overwrite a newer revision.</p>
    <Planner initial={tripDraft(saved)} catalogue={saved.catalogue} addId="" storageKey={`gochitral.trip-edit.${id}`} />
  </section>;
}
