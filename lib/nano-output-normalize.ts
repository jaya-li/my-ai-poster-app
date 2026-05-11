import sharp from "sharp";

/**
 * 将 Nanobanana 返回的图规范为约定像素画布。
 *
 * 策略：**完整保留上游图（contain，零裁切） + 两侧/上下用同一张图的模糊放大版本铺底**。
 * - 不会切掉任何 UI、按钮、IP、二维码；
 * - 也不会出现刺眼的纯白/透明 letterbox；
 * - 边缘填充为同张图模糊后景，视觉上像景深虚化背景。
 */
export async function normalizeRemoteImageToLayoutPixels(
  imageUrlOrDataUrl: string,
  width: number,
  height: number
): Promise<string> {
  if (width <= 0 || height <= 0) {
    throw new Error("版式目标宽/高无效");
  }

  const input = await readImageBuffer(imageUrlOrDataUrl);
  const meta = await sharp(input).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;

  /** 上游与目标比例几乎一致时不需要 letterbox，直接 fit 到目标即可（避免无谓的模糊计算与 PNG 体积膨胀） */
  if (srcW > 0 && srcH > 0) {
    const srcRatio = srcW / srcH;
    const dstRatio = width / height;
    const diff = Math.abs(Math.log(srcRatio / dstRatio));
    if (diff < 0.01) {
      const out = await sharp(input)
        .resize(width, height, { fit: "fill" })
        .png()
        .toBuffer();
      return `data:image/png;base64,${out.toString("base64")}`;
    }
  }

  /** 1) 模糊背景：用 cover 把上游图填满目标画布，再做大半径高斯模糊 */
  const background = await sharp(input)
    .resize(width, height, { fit: "cover", position: "centre" })
    .blur(40)
    .modulate({ brightness: 0.92 })
    .toBuffer();

  /** 2) 前景主图：contain 居中放进目标画布（保留原图所有内容、不裁切） */
  const foreground = await sharp(input)
    .resize(width, height, {
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  /** 3) 合成：模糊背景在底，主图在中央 */
  const out = await sharp(background)
    .composite([{ input: foreground, gravity: "centre" }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${out.toString("base64")}`;
}

async function readImageBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    if (comma === -1) throw new Error("无效的 data URL");
    const b64 = src.slice(comma + 1).trim();
    return Buffer.from(b64, "base64");
  }

  const res = await fetch(src, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) {
    throw new Error(`拉取生图结果失败：HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 强制像素对齐：失败时抛错而不是静默回退原图。
 * 这样可避免前端拿到“生成成功但尺寸不达标”的结果。
 */
export async function tryNormalizeRemoteImageToLayoutPixels(
  imageUrl: string,
  width: number,
  height: number
): Promise<string> {
  try {
    return await normalizeRemoteImageToLayoutPixels(imageUrl, width, height);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `图片像素对齐失败（目标 ${width}×${height}）。已阻止返回非标准尺寸结果，请重试。原因：${reason}`
    );
  }
}
