import Link from "next/link";
import { requireRole, userDatabase } from "@/lib/auth/session";
import { KnowledgeForm } from "./knowledge-form";
import "./knowledge.css";

export const metadata = { title: "Reviewed knowledge | GoChitral Admin" };
export const dynamic = "force-dynamic";

export default async function KnowledgeAdmin({ searchParams }: PageProps<"/admin/knowledge">) {
  const identity = await requireRole("administrator", "/admin/knowledge");
  if (!identity) return <><h1>Access denied</h1><p>This workspace requires an administrator account.</p></>;
  const [rules, query] = await Promise.all([
    userDatabase(identity, (tx) => tx.knowledgeRule.findMany({ include: { audits: { orderBy: { createdAt: "desc" }, take: 3, select: { action: true, reason: true, createdAt: true, actorId: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100 })),
    searchParams,
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const result = typeof query.result === "string" ? query.result : "";
  const messages: Record<string, string> = { draft: "Draft saved.", published: "Reviewed answer published.", retired: "Answer retired.", invalid: "Check the required fields and matching words, then try again.", dates: "Expiry must be after the review date and must not be in the past when publishing.", related: "Each related ID must be a currently published listing.", conflict: "This rule changed in another tab. Reload before editing again.", origin: "Request origin rejected.", denied: "Administrator access is required.", "save-error": "The rule could not be saved. Check the data and try again." };
  return <><p><Link className="text-link" href="/admin">← Admin dashboard</Link></p><p className="eyebrow">Sourced visitor information</p><h1>Knowledge and answers</h1>
    <p>Only current published answers are used by the question drawer. Every answer needs an HTTPS source and review date. Retired and expired answers are not shown to visitors.</p>
    {messages[result] && <p className="knowledge-result" role="status">{messages[result]}</p>}
    <details className="knowledge-new" open={result === "invalid" || result === "dates" || result === "related"}><summary>Add a reviewed answer</summary><KnowledgeForm today={today} /></details>
    <h2>Saved rules ({rules.length})</h2>
    {!rules.length && <p>No rules yet. Add one with a trusted public source before testing visitor answers.</p>}
    <div className="knowledge-rules">{rules.map((rule) => <details key={rule.id} className="knowledge-rule"><summary>{rule.topic} · {rule.status} · version {rule.version}</summary>
      <p>{rule.answer}</p><p><a href={rule.sourceUrl} target="_blank" rel="noreferrer">{rule.sourceTitle}</a> · reviewed {rule.reviewedAt.toISOString().slice(0, 10)}{rule.expiresAt ? ` · expires ${rule.expiresAt.toISOString().slice(0, 10)}` : " · no expiry"}</p>
      <p>Matching terms · {rule.terms.join(", ") || "none"}</p><p>Related listings · {rule.relatedListingIds.join(", ") || "none"}</p>
      {rule.audits.length > 0 && <details><summary>Recent changes</summary><ul>{rule.audits.map((audit, index) => <li key={`${audit.action}-${index}`}>{audit.action} · {audit.reason} · {audit.createdAt.toISOString().slice(0, 10)}</li>)}</ul></details>}
      <KnowledgeForm rule={rule} today={today} />
    </details>)}</div>
  </>;
}
