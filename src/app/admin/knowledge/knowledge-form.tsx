import type { KnowledgeRule } from "@/generated/prisma/client";
import { saveKnowledge } from "./actions";

export function KnowledgeForm({ rule, today }: { rule?: KnowledgeRule; today: string }) {
  return <form className="knowledge-form" action={saveKnowledge}>
    <input type="hidden" name="id" value={rule?.id ?? ""} />
    <input type="hidden" name="version" value={rule?.version ?? 0} />
    <label>Topic<input name="topic" required minLength={3} maxLength={120} defaultValue={rule?.topic ?? ""} /></label>
    <label>Approved answer<textarea name="answer" required minLength={10} maxLength={2500} defaultValue={rule?.answer ?? ""} /></label>
    <label>Matching words or phrases <small>One per line, up to 24. Use phrases visitors may type.</small><textarea name="terms" required maxLength={2000} defaultValue={rule?.terms.join("\n") ?? ""} /></label>
    <div className="knowledge-form-pair"><label>Source title<input name="sourceTitle" required minLength={3} maxLength={180} defaultValue={rule?.sourceTitle ?? ""} /></label>
      <label>Secure source URL<input name="sourceUrl" type="url" pattern="https://.*" required defaultValue={rule?.sourceUrl ?? ""} /></label></div>
    <div className="knowledge-form-pair"><label>Last reviewed<input name="reviewedAt" type="date" required defaultValue={rule?.reviewedAt.toISOString().slice(0, 10) ?? today} /></label>
      <label>Expires on (optional)<input name="expiresAt" type="date" min={rule?.reviewedAt.toISOString().slice(0, 10) ?? today} defaultValue={rule?.expiresAt?.toISOString().slice(0, 10) ?? ""} /></label></div>
    <label>Related published listing IDs <small>One ID per line, up to 12. The server checks each is published.</small><textarea name="relatedListingIds" maxLength={1500} defaultValue={rule?.relatedListingIds.join("\n") ?? ""} /></label>
    <label>Admin change reason<input name="reason" required minLength={3} maxLength={500} placeholder="For example, verified against official visitor page" /></label>
    <div className="knowledge-form-actions"><button type="submit" name="status" value="draft">Save draft</button>
      <button type="submit" name="status" value="published">Publish reviewed answer</button>{rule && rule.status !== "retired" && <button type="submit" name="status" value="retired">Retire this answer</button>}</div>
    {rule && <p>Current status · {rule.status} · Version {rule.version}</p>}
  </form>;
}
