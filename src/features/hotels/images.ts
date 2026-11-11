import sharp from "sharp";

export const maxUploadBytes = 5 * 1024 * 1024;
export async function processHotelImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > maxUploadBytes) throw new Error("Choose an image smaller than 5 MB.");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("Choose a real JPEG, PNG or WebP image.");
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000 || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image dimensions.");
    const { data, info } = await image.rotate().resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (data.length > 2 * 1024 * 1024) throw new Error("The processed image is too large.");
    return { data, width: info.width, height: info.height };
  } catch { throw new Error("The image could not be decoded. Use a non-animated JPEG, PNG or WebP under 20 megapixels."); }
}
