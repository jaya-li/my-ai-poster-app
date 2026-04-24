/**
 * 浏览器端压缩参考图，避免 POST /api/generate-kv 的 JSON 超过 Vercel ~4.5MB 请求体限制。
 */
export async function fileToCompressedDataUrl(
  file: File,
  opts?: { maxSide?: number; quality?: number }
): Promise<string> {
  const maxSide = opts?.maxSide ?? 2048;
  const quality = opts?.quality ?? 0.88;

  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    const longest = Math.max(w, h);
    if (longest > maxSide) {
      const s = maxSide / longest;
      w = Math.round(w * s);
      h = Math.round(h * s);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建画布");
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}

/** 版式含二维码：边稍大、质量略高，仍控制体积 */
export function compressLayoutFile(file: File) {
  return fileToCompressedDataUrl(file, { maxSide: 2560, quality: 0.92 });
}

/** 画风 / 金币 */
export function compressRefFile(file: File) {
  return fileToCompressedDataUrl(file, { maxSide: 1920, quality: 0.86 });
}

/** IP 角色：轮廓与配饰细节更重要，略提高边长与 JPEG 质量 */
export function compressIpRefFile(file: File) {
  return fileToCompressedDataUrl(file, { maxSide: 2560, quality: 0.91 });
}
