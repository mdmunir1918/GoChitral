import { config } from "dotenv";
import { getPrisma } from "../src/lib/prisma";
import { deletePhoto } from "../src/lib/storage/r2";
config({ path: [".env.local", ".env"], quiet: true });
async function cleanup() {
  const db = getPrisma(); const cutoff = new Date(Date.now() - 7 * 86400000);
  try {
    const candidates = await db.hotelPhoto.findMany({ where: { approved: false, createdAt: { lt: cutoff }, hotel: { status: "draft", updatedAt: { lt: cutoff } } }, select: { id: true, hotelId: true }, take: 100 });
    if (!process.argv.includes("--delete")) {
      console.log(`Dry run: ${candidates.length} abandoned private photos could be removed. No objects were deleted. Review before running media:cleanup -- --delete.`);
      return;
    }
    let removed = 0;
    for (const item of candidates) await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public."HotelDraft" WHERE id=${item.hotelId} FOR UPDATE`;
      const photo = await tx.hotelPhoto.findFirst({ where: { id: item.id, approved: false, createdAt: { lt: cutoff }, hotel: { status: "draft", updatedAt: { lt: cutoff } } } });
      if (!photo) return;
      await deletePhoto(photo.key);
      await tx.hotelPhoto.delete({ where: { id: photo.id } }); removed++;
    });
    console.log(`Removed ${removed} abandoned private photos. Approved photos and submitted hotels were preserved.`);
  } finally { await db.$disconnect(); }
}
cleanup();
