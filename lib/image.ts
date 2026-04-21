export function getImageMimeFromBase64(base64: string) {
  const matched = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return matched?.[1] || "image/png";
}

export function stripDataUrlPrefix(base64: string) {
  return base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

export async function getImageSizeFromBuffer(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(buffer).metadata();

  if (!meta.width || !meta.height) {
    throw new Error("Cannot detect image size");
  }

  return { width: meta.width, height: meta.height };
}
