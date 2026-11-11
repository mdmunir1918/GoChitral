import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { session, userDatabase } from "@/lib/auth/session";
import { maxUploadBytes, processHotelImage } from "@/features/hotels/images";
import { deletePhoto, putPhoto } from "@/lib/storage/r2";
import { attemptAllowed } from "@/lib/auth/credentials";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN) return NextResponse.json({ error: "Refresh the page at the app's usual address and try again." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > maxUploadBytes + 65536) return NextResponse.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 });
  const identity = await session();
  if (!identity) return NextResponse.json({ error: "Your session has ended. Sign in again before uploading." }, { status: 401 });
  const { id } = await params;
  const draft = await userDatabase(identity, (tx) => tx.hotelDraft.findFirst({ where: { id, ownerId: identity.user.id, status: "draft" }, select: { id: true } }));
  if (!draft) return NextResponse.json({ error: "Save an owned draft before adding photos." }, { status: 403 });
  if (!await attemptAllowed(identity.user.id, "upload")) return NextResponse.json({ error: "Too many uploads. Please try again in 15 minutes." }, { status: 429 });
  let key: string | undefined;
  let stage: "image" | "storage" | "database" = "image";
  try {
    // Read a bounded body even if Content-Length is absent or untrusted.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose an image.");
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const part = await reader.read(); if (part.done) break; total += part.value.length;
      if (total > maxUploadBytes + 65536) { await reader.cancel(); return NextResponse.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 }); }
      chunks.push(part.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("photo");
    if (!(file instanceof File) || form.get("rights") !== "yes") throw new Error("Choose a photo and confirm you have permission to use it.");
    const image = await processHotelImage(Buffer.from(await file.arrayBuffer()));
    const photoId = randomUUID();
    key = `${identity.user.id}/${id}/${photoId}.webp`;
    // Upload before opening the write transaction. Slow storage must not hold
    // a database lock or cause a transaction timeout. The insert trigger
    // rechecks draft status/ownership/quotas if anything changed meanwhile.
    stage = "storage";
    await putPhoto(key, image.data);
    stage = "database";
    const photo = await userDatabase(identity, async (tx) => {
      // The insert trigger locks the hotel and checks owner, path and quotas.
      const photo = await tx.hotelPhoto.create({ data: { id: photoId, hotelId: id, key: key!, width: image.width, height: image.height, bytes: image.data.length } });
      return { id: photo.id, width: photo.width, height: photo.height };
    });
    return NextResponse.json(photo, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (key) await deletePhoto(key).catch(() => {});
    if (stage === "storage") return NextResponse.json({ error: "Photo storage is taking too long or is unavailable. Please try again shortly." }, { status: 503 });
    if (stage === "database") return NextResponse.json({ error: "The photo could not be saved. Check that the hotel is still a draft and has fewer than 8 photos, then try again." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Choose a valid JPEG, PNG or WebP image." }, { status: 400 });
  }
}
