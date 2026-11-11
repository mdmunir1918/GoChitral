import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { dateLabel, money } from "@/features/planner/model";
import { decide } from "./actions";

export const metadata = { title: "Guide requests" };
export default async function GuideRequests({ searchParams }: PageProps<"/admin/guide-requests">) {
  const identity = await requireRole("administrator", "/admin/guide-requests");
  if (!identity) return <><h1>Access denied</h1><p>Administrator access is required.</p></>;
  const [{ result }, requests] = await Promise.all([
    searchParams,
    userDatabase(identity, tx => tx.guideRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 100,
      include: { audits: { orderBy: { createdAt: "desc" }, take: 1 } } })),
  ]);
  const messages: Record<string, string> = { confirmed: "Guide request confirmed.", declined: "Guide request declined.", stale: "This request was already decided in another session.", overlap: "This decision could not be confirmed. Check for overlapping confirmed service dates and try again.", denied: "Administrator access is required.", invalid: "Enter a decision reason and try again.", error: "The decision could not be saved. Try again.", };
  return <><p><Link className="text-link" href="/admin">← Publishing workspace</Link></p><h1>Guide requests</h1>
    {typeof result === "string" && messages[result] && <p className="editor-message" role="status">{messages[result]}</p>}
    {!requests.length && <p>No guide requests yet.</p>}
    <div className="moderation-list">{requests.map(request => <article key={request.id}>
      <div><h2>{request.guideTitle} · {request.reference}</h2><p>{request.status} · {dateLabel(request.startDate.toISOString().slice(0,10))} – {dateLabel(request.endDate.toISOString().slice(0,10))}</p>
        <p>Requested estimate: {request.priceMinor === null ? "Unknown" : `${money(request.priceMinor)} · per group per day`}</p>
        {request.audits[0] && <p>Decision reason: {request.audits[0].reason}</p>}
      </div>
      {request.status === "pending" && <form action={decide} className="guide-decision-form">
        <input type="hidden" name="id" value={request.id} />
        <label htmlFor={`reason-${request.id}`}>Decision reason<textarea id={`reason-${request.id}`} name="reason" required minLength={1} maxLength={1000} rows={2} /></label>
        <button name="decision" value="confirmed" type="submit">Confirm</button><button name="decision" value="declined" type="submit">Decline</button>
      </form>}
    </article>)}</div>
  </>;
}
