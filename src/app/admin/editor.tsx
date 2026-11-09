"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { categoryLabels } from "@/features/catalogue/types";
import type { ListingContent, EditorResult } from "@/features/publishing/validation";
import { moderate } from "./actions";

type Props = {
  initial: ListingContent;
  listingId: string;
  version: number;
  status: "draft" | "published" | "suspended";
  evidence: string;
  photos: { id: string; caption: string; author: string }[];
  destinations: { id: string; title: string; status: string }[];
};

export function ListingEditor(props: Props) {
  const [content, setContent] = useState(props.initial);
  const [evidence, setEvidence] = useState(props.evidence);
  const [reason, setReason] = useState("");
  const initialState: EditorResult = { listingId: props.listingId, version: props.version, status: props.status, message: "" };
  const [result, action, pending] = useActionState(moderate, initialState);

  function field(name: keyof ListingContent, label: string, maxLength: number, multiline = false) {
    const control = {
      id: name, name, value: content[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContent({ ...content, [name]: event.target.value }),
      maxLength,
    };
    return <label htmlFor={name}>{label}
      {multiline ? <textarea {...control} rows={name === "description" ? 6 : 3} required /> : <input {...control} required={["title", "slug", "location", "reviewed"].includes(name)} type={name === "reviewed" ? "date" : ["sourceUrl", "contactUrl"].includes(name) ? "url" : "text"} readOnly={name === "slug" && Boolean(result.listingId)} />}
    </label>;
  }

  return <form action={action} className="listing-editor">
    <input name="listingId" type="hidden" value={result.listingId} />
    <input name="version" type="hidden" value={result.version} />
    <input name="category" type="hidden" value={content.category} />
    <p className="editor-state">{result.status} · Revision {result.version}</p>
    {result.message && <div role="status" className="editor-message"><p>{result.message}</p>
      {result.url && <Link className="text-link" href={result.url} target="_blank">Open public listing</Link>}
      {result.conflict && <button type="button" onClick={() => window.location.reload()}>Reload saved version</button>}
    </div>}
    <fieldset disabled={pending}>
      <legend>Listing content</legend>
      <label htmlFor="category">Category
        <select id="category" value={content.category} disabled={Boolean(result.listingId)}
          onChange={(event) => setContent({ ...content, category: event.target.value as ListingContent["category"] })}>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {field("title", "Title", 160)}
      {field("slug", "URL slug", 100)}
      {field("location", "Location", 120)}
      {content.category !== "destinations" && <label htmlFor="destinationId">Destination
        <select id="destinationId" name="destinationId" required value={content.destinationId}
          onChange={(event) => setContent({ ...content, destinationId: event.target.value })}>
          <option value="">Choose a destination</option>
          {props.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.title} · {destination.status}</option>)}
        </select>
      </label>}
      {content.category === "destinations" && <input type="hidden" name="destinationId" value="" />}
      {field("summary", "Summary", 500, true)}
      {field("description", "Description", 10000, true)}
      {field("visitorNote", "Visitor and access notes", 3000, true)}
      <label htmlFor="photoId">Approved photograph
        <select id="photoId" name="photoId" required value={content.photoId}
          onChange={(event) => setContent({ ...content, photoId: event.target.value })}>
          <option value="">Choose a photograph</option>
          {props.photos.map((photo) => <option key={photo.id} value={photo.id}>{photo.caption} · {photo.author}</option>)}
        </select>
      </label>
      {field("sourceTitle", "Information source title", 200)}
      {field("sourceUrl", "Information source URL (HTTPS)", 500)}
      {field("reviewed", "Information reviewed on", 10)}
      {field("contactUrl", "Public contact website (HTTPS, optional)", 500)}
      <div className="coordinate-fields">
        {field("latitude", "Latitude (optional)", 30)}
        {field("longitude", "Longitude (optional)", 30)}
      </div>
      {content.category === "guides" && <label htmlFor="evidence">Private credential review evidence
        <textarea id="evidence" name="evidence" rows={3} maxLength={10000} value={evidence} onChange={(event) => setEvidence(event.target.value)} />
      </label>}
      {content.category !== "guides" && <input name="evidence" type="hidden" value="" />}
      <label htmlFor="reason">Reason for this change
        <textarea id="reason" name="reason" rows={2} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <div className="editor-actions">
        <button name="intent" value="save" type="submit">Save draft</button>
        {result.status !== "suspended" && <button name="intent" value="publish" type="submit">Publish revision</button>}
        {result.status === "published" && <button name="intent" value="suspend" type="submit" formNoValidate>Suspend listing</button>}
        {result.status === "suspended" && <button name="intent" value="reactivate" type="submit">Reactivate and publish revision</button>}
      </div>
    </fieldset>
    {pending && <p role="status">Saving…</p>}
    {result.listingId && <Link className="text-link" href={`/admin/listings/${result.listingId}`}>Open saved listing and history</Link>}
  </form>;
}
