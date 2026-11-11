import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount, userDatabase } from "@/lib/auth/session";
import { dateLabel, money } from "@/features/planner/model";

export const metadata = { title: "Guide request", robots: { index: false, follow: false } };
export default async function GuideRequestPage({ params }: PageProps<"/my-trips/requests/[id]">) {
  const { id } = await params;
  if (!/^GC-[A-F0-9]{8}$/.test(id) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const identity = await requireAccount(`/my-trips/requests/${id}`);
  const request = await userDatabase(identity, tx => tx.guideRequest.findFirst({
    where: id.startsWith("GC-") ? { reference: id } : { id },
    include: { trip: { select: { id: true, title: true } }, audits: { orderBy: { createdAt: "asc" } } },
  }));
  if (!request) notFound();
  return <><p><Link className="text-link" href={`/my-trips/${request.trip.id}`}>← Back to {request.trip.title}</Link></p>
    <header className="trip-header"><p className="listing-location">Guide request · {request.reference}</p><h1>{request.guideTitle}</h1>
      <p>{dateLabel(request.startDate.toISOString().slice(0,10))} – {dateLabel(request.endDate.toISOString().slice(0,10))} · inclusive dates</p>
      <p>Status · <strong>{request.status}</strong></p>
      <p>Requested price snapshot · {request.priceMinor === null ? "Price unknown" : `${money(request.priceMinor)} per group per service day. This is an estimate.`}</p>
      <p>{request.status === "pending" ? "An administrator has not decided this request yet. This is not a confirmed booking." : request.status === "confirmed" ? "This guide request was confirmed by an administrator. Confirm service details with the guide before travel." : "This request was declined. It remains in your history."}</p>
    </header>
  </>;
}
