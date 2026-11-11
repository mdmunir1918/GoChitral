"use client";
import Link from "next/link";
import { useActionState } from "react";
import { decideHotel, type HotelReviewResult } from "./actions";
export function HotelReviewForm({ id, version }: { id: string; version: number }) {
  const [result, action, pending] = useActionState(decideHotel, { message: "" } as HotelReviewResult);
  return <form action={action} className="listing-editor"><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={version} />
    {result.message && <p role="status" className="editor-message">{result.message}{result.url && <Link href={result.url}>Open public hotel</Link>}</p>}
    <fieldset disabled={pending || Boolean(result.url)}><label>Review note<textarea name="reason" required maxLength={1000} rows={3} /></label><div className="editor-actions"><button name="intent" value="approve">Approve and publish</button><button name="intent" value="changes">Request changes</button></div></fieldset>
    {pending && <p role="status">Saving review…</p>}
  </form>;
}
