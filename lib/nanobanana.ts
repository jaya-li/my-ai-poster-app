/**
 * Nanobanana Pro：请在 `.env.local` 填写 `NANOBANANA_API_KEY`（勿提交仓库）。
 * 部署时在 Vercel Environment Variables 中配置同名变量。
 *
 * 默认网关与 https://ai.t8star.cn 一致；可用环境变量 `NANOBANANA_BASE_URL` 覆盖。
 */
export const NANOBANANA_DEFAULT_BASE_URL = "https://ai.t8star.cn";

export type NanoReferenceImage = {
  name: string;
  base64: string;
  mimeType: string;
};

function pickImageUrl(body: Record<string, unknown>): string | null {
  const direct =
    (typeof body.imageUrl === "string" && body.imageUrl) ||
    (typeof body.image_url === "string" && body.image_url) ||
    (typeof body.url === "string" && body.url);
  if (direct) return direct;

  const data = body.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const nested =
      (typeof d.url === "string" && d.url) ||
      (typeof d.imageUrl === "string" && d.imageUrl) ||
      (typeof d.image_url === "string" && d.image_url);
    if (nested) return nested;
  }

  const result = body.result;
  if (result && typeof result === "object") {
    return pickImageUrl(result as Record<string, unknown>);
  }

  return null;
}

export function parseNanoImageResponse(json: unknown): { imageUrl: string } {
  if (!json || typeof json !== "object") {
    throw new Error("Nanobanana 返回格式无效");
  }
  const url = pickImageUrl(json as Record<string, unknown>);
  if (!url) {
    throw new Error("Nanobanana 返回中未找到图片 URL（请核对接口字段或调整 lib/nanobanana.ts）");
  }
  return { imageUrl: url };
}

export async function generateNanoImage(params: {
  prompt: string;
  width: number;
  height: number;
  quality?: "2k" | "standard";
  referenceImages?: NanoReferenceImage[];
}) {
  const base =
    process.env.NANOBANANA_BASE_URL?.trim() || NANOBANANA_DEFAULT_BASE_URL;
  /** @see `.env.local` → `NANOBANANA_API_KEY` ← 用户在此填写 */
  const key = process.env.NANOBANANA_API_KEY?.trim();
  if (!key) {
    throw new Error("缺少环境变量 NANOBANANA_API_KEY（请在 .env.local 中填写）");
  }

  const url = `${base.replace(/\/$/, "")}/generate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      width: params.width,
      height: params.height,
      quality: params.quality ?? "2k",
      referenceImages: params.referenceImages ?? [],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nanobanana API error: ${text}`);
  }

  const json: unknown = await res.json();
  return parseNanoImageResponse(json);
}
