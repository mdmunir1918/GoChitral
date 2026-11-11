import { NextResponse, type NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { session, userDatabase } from "@/lib/auth/session";
import { getPhoto, previewPhoto } from "@/lib/storage/r2";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE gochitral_public`;
    return tx.hotelPhoto.findUnique({ where: { id } });
  });
  if (photo) {
    try {
      const object = await getPhoto(photo.key);
      if (!object.Body) return new Response(null, { status: 404 });
      return new Response(object.Body.transformToWebStream(), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    } catch { return new Response(null, { status: 503 }); }
  }
  const identity = await session();
  if (!identity) return new Response(null, { status: 403 });
  const privatePhoto = await userDatabase(identity, (tx) => tx.hotelPhoto.findUnique({ where: { id } }));
  if (!privatePhoto) return new Response(null, { status: 403 });
  try {
    const response = NextResponse.redirect(await previewPhoto(privatePhoto.key));
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return new Response(null, { status: 503 }); }
}
