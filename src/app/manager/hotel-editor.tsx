"use client";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { HotelOverview } from "@/features/hotels/overview";
import type { HotelInput, HotelResult } from "@/features/hotels/validation";
import { removeHotelPhoto, saveHotelDraft } from "./actions";
type Photo = { id: string; width: number; height: number };
type Props = { initial: HotelInput; id: string; version: number; status: string; reviewNote: string; photos: Photo[]; destinations: { id: string; title: string }[] };
export function HotelEditor(props: Props) {
  const [content, setContent] = useState(props.initial);
  const [tab, setTab] = useState("Details");
  const [photos, setPhotos] = useState(props.photos);
  const [amenities, setAmenities] = useState(props.initial.amenities.join(", "));
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [result, action, pending] = useActionState(saveHotelDraft, { id: props.id, version: props.version, status: props.status, message: "" } as HotelResult);
  const payload = { ...content, amenities: [...new Set(amenities.split(",").map((s) => s.trim()).filter(Boolean))] };
  const uploadReady = Boolean(file && rights && photos.length < 8 && (result.status ?? props.status) === "draft");
  function field(name: "title" | "contactUrl" | "summary" | "description" | "visitorNote", label: string, maxLength: number, multiline = false) {
    const control = { value: content[name], maxLength, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContent({ ...content, [name]: e.target.value }) };
    return <label>{label}{multiline ? <textarea {...control} rows={name === "description" ? 5 : 3} /> : <input {...control} type={name === "contactUrl" ? "url" : "text"} />}</label>;
  }
  return <><p>Status · {(result.status ?? props.status).replaceAll("_", " ")} · Revision {result.version}</p>
    {props.reviewNote && <p className="hotel-notice">Admin note · {props.reviewNote}</p>}
    <nav className="hotel-tabs" aria-label="Hotel editor sections">{["Details", "Rooms", "Photos", "Preview"].map((name) => <button key={name} type="button" aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)}>{name}</button>)}</nav>
    <form action={action} className="hotel-editor" noValidate>
      <input name="id" type="hidden" value={result.id} /><input name="version" type="hidden" value={result.version} /><input name="content" type="hidden" value={JSON.stringify(payload)} />
      {result.message && <p className="hotel-notice" role="status">{result.message}{result.conflict && <button type="button" onClick={() => window.location.reload()}>Reload saved hotel</button>}</p>}
      <fieldset disabled={pending || uploading}>
        <div hidden={tab !== "Details"} className="hotel-fields">
          {field("title", "Hotel name", 160)}
          <label>Destination<select value={content.destinationId} onChange={(e) => setContent({ ...content, destinationId: e.target.value })}><option value="">Choose a destination</option>{props.destinations.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
          {field("contactUrl", "Public contact website (HTTPS)", 500)}{field("summary", "Short summary", 500, true)}{field("description", "Hotel description", 10000, true)}{field("visitorNote", "Guest and access notes", 3000, true)}
          <label>Amenities (separate with commas)<input value={amenities} maxLength={1200} onChange={(e) => setAmenities(e.target.value)} /></label>
        </div>
        <div hidden={tab !== "Rooms"}>
          <h2>Room types</h2><p>Set the price in PKR per night. Archive a room to stop offering it; past records stay available.</p>
          {content.rooms.map((room, index) => {
            const change = (values: Partial<HotelInput["rooms"][number]>) => setContent({ ...content, rooms: content.rooms.map((r, i) => i === index ? { ...r, ...values } : r) });
            return <div className="hotel-room-editor" key={room.id}><h3>Room {index + 1}</h3>
              <label>Room name<input value={room.title} maxLength={100} onChange={(e) => change({ title: e.target.value })} /></label>
              <label>Guests<input type="number" min={1} max={20} value={room.capacity} onChange={(e) => change({ capacity: Number(e.target.value) })} /></label>
              <label>Nightly rate (PKR)<input inputMode="decimal" value={room.nightlyRate} onChange={(e) => change({ nightlyRate: e.target.value })} /></label>
              <label>Availability notes<input value={room.availabilityNote} maxLength={500} onChange={(e) => change({ availabilityNote: e.target.value })} /></label>
              <label className="hotel-check"><input type="checkbox" checked={room.archived} onChange={(e) => change({ archived: e.target.checked })} />Archived</label>
            </div>;
          })}
          <button type="button" disabled={content.rooms.length >= 20} onClick={() => setContent({ ...content, rooms: [...content.rooms, { id: crypto.randomUUID(), title: "", capacity: 2, nightlyRate: "", availabilityNote: "", archived: false }] })}>Add a room type</button>
        </div>
        <div hidden={tab !== "Preview"}><h2>{content.title || "Hotel preview"}</h2><p>{content.summary}</p><p>{content.description}</p>
          <HotelOverview amenities={payload.amenities} rooms={content.rooms.filter((r) => !r.archived).map((r) => ({ ...r, nightlyMinor: /^\d+(\.\d{1,2})?$/.test(r.nightlyRate) ? Math.round(Number(r.nightlyRate) * 100) : null }))} />
        </div>
        <p className="manager-links"><button name="intent" value="save" type="submit">{pending ? "Saving…" : "Save draft"}</button><button name="intent" value="submit" type="submit">Submit for review</button></p>
      </fieldset>
    </form>
    <section hidden={tab !== "Photos"} className="hotel-photos"><h2>Hotel photos</h2><p>Up to 8 photos per hotel. Use JPEG, PNG or WebP under 5 MB. The first photo is the cover. Photos stay private until approval.</p>
      {!result.id ? <p>Save your hotel draft before adding photos.</p> : <>
        {(result.status ?? props.status) !== "draft" && <p>Save a draft first if you want to change photos.</p>}
        <label>Photo<input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploadMessage(""); }} /></label>
        <label className="hotel-check"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />I have permission to use this photo.</label>
        {!file ? <p>Choose a photo, then tick the permission box to enable Upload photo.</p> : !rights ? <p>Tick the permission box to enable Upload photo.</p> : photos.length >= 8 ? <p>You have 8 photos. Remove one before adding another.</p> : null}
        <button type="button" className="photo-upload-button" disabled={!uploadReady || uploading || pending} onClick={async () => {
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) { setUploadMessage("Choose an image smaller than 5 MB."); return; }
          setUploading(true); setUploadMessage("");
          try { const form = new FormData(); form.set("photo", file); form.set("rights", "yes");
            const response = await fetch(`/api/manager/hotels/${result.id}/photos`, { method: "POST", body: form });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.id) throw new Error(data?.error || "The upload did not finish. Check your connection and try again.");
            setPhotos((current) => [...current, data]); setFile(null); setRights(false); setUploadMessage("Photo added to your private draft. Submit for review when you are ready.");
            if (photoInput.current) photoInput.current.value = "";
          } catch (error) { setUploadMessage(error instanceof Error ? error.message : "Upload failed. Please try again."); } finally { setUploading(false); }
        }}>{uploading ? "Uploading…" : "Upload photo"}</button>
      </>}
      {uploading && <p role="status">Uploading and saving your photo. Please keep this page open.</p>}
      {uploadMessage && <p role="status">{uploadMessage}</p>}
      <div className="hotel-photo-grid">{photos.map((photo) => <figure key={photo.id}><Image unoptimized src={`/api/hotel-photos/${photo.id}`} width={photo.width} height={photo.height} alt="Hotel photo preview" sizes="(max-width: 600px) 90vw, 30vw" /><button type="button" disabled={uploading || pending || (result.status ?? props.status) !== "draft"} onClick={async () => {
        try { if (!await removeHotelPhoto(photo.id)) throw new Error(); setPhotos(photos.filter((p) => p.id !== photo.id)); } catch { setUploadMessage("The photo could not be removed. Save a draft and try again."); }
      }}>Remove from draft</button></figure>)}</div>
    </section>
    {result.id && <p><Link href={`/manager/hotels/${result.id}`}>Open saved hotel</Link></p>}
  </>;
}
