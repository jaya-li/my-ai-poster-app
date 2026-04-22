import { explainFetchFailure } from "@/lib/fetch-error";

/**
 * Nanobanana Pro（T8Star）：请在 `.env.local` 填写 `NANOBANANA_API_KEY`。
 *
 * T8Star 生图接口为 OpenAI Images 风格，见：
 * https://github.com/zhaotututu/ComfyUI-TutuBanana/blob/main/TutuNanoBananaPro.py
 * 默认：POST {BASE_URL}/v1/images/generations ，模型 nano-banana-2
 */
export const NANOBANANA_DEFAULT_BASE_URL = "https://ai.t8star.cn";

/** T8Star 文档与 ComfyUI 节点中使用的路径 */
export const NANOBANANA_DEFAULT_IMAGE_PATH = "/v1/images/generations";

export const NANOBANANA_DEFAULT_MODEL = "nano-banana-2";

const T8STAR_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type NanoReferenceImage = {
  name: string;
  base64: string;
  mimeType: string;
};

function closestAspectRatio(width: number, height: number): string {
  const target = width / height;
  let best: string = "1:1";
  let bestScore = Infinity;
  for (const ar of T8STAR_ASPECT_RATIOS) {
    const [a, b] = ar.split(":").map(Number);
    const r = a / b;
    const score = Math.abs(Math.log(r / target));
    if (score < bestScore) {
      bestScore = score;
      best = ar;
    }
  }
  return best;
}

function qualityToImageSize(quality: "2k" | "standard" | undefined): "1K" | "2K" | "4K" {
  if (quality === "standard") return "1K";
  return "2K";
}

function referenceToDataUris(refs: NanoReferenceImage[]): string[] {
  return refs.map((r) => {
    const mime = r.mimeType || "image/png";
    return `data:${mime};base64,${r.base64}`;
  });
}

function pickImageUrl(body: Record<string, unknown>): string | null {
  const direct =
    (typeof body.imageUrl === "string" && body.imageUrl) ||
    (typeof body.image_url === "string" && body.image_url) ||
    (typeof body.url === "string" && body.url);
  if (direct) return direct;

  const rawData = body.data;
  if (Array.isArray(rawData) && rawData.length > 0) {
    const first = rawData[0];
    if (first && typeof first === "object") {
      const row = first as Record<string, unknown>;
      if (typeof row.url === "string") return row.url;
      if (typeof row.b64_json === "string") {
        return `data:image/png;base64,${row.b64_json}`;
      }
    }
  }

  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const d = rawData as Record<string, unknown>;
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

async function readResponseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (
    trimmed.startsWith("<!") ||
    trimmed.startsWith("<html") ||
    trimmed.toLowerCase().startsWith("<!doctype")
  ) {
    const snippet = trimmed.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `生图接口返回了网页（HTML）而不是 JSON，通常是请求路径错误。当前请使用 T8Star 的 /v1/images/generations。响应开头：${snippet}…`
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const snippet = trimmed.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`生图接口返回不是合法 JSON：${snippet}…`);
  }
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
  const path =
    process.env.NANOBANANA_IMAGE_PATH?.trim() || NANOBANANA_DEFAULT_IMAGE_PATH;
  const model =
    process.env.NANOBANANA_MODEL?.trim() || NANOBANANA_DEFAULT_MODEL;

  const key = process.env.NANOBANANA_API_KEY?.trim();
  if (!key) {
    throw new Error("缺少环境变量 NANOBANANA_API_KEY（请在 .env.local 中填写）");
  }

  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const aspectRatio = closestAspectRatio(params.width, params.height);
  const imageSize = qualityToImageSize(params.quality);

  const body: Record<string, unknown> = {
    model,
    prompt: params.prompt,
    aspect_ratio: aspectRatio,
    image_size: imageSize,
    response_format: "url",
  };

  const refs = params.referenceImages?.filter((r) => r.base64?.length) ?? [];
  if (refs.length > 0) {
    body.image = referenceToDataUris(refs);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e) {
    throw new Error(
      explainFetchFailure(
        `调用 Nanobanana 失败（${url}）。请检查：网络能否访问 T8Star、API Key、路径 ${path}；参考图过多/过大时也可导致超时`,
        e
      )
    );
  }

  const json = await readResponseJson(res);

  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "error" in json
        ? JSON.stringify((json as { error: unknown }).error)
        : JSON.stringify(json);
    throw new Error(`Nanobanana API error (${res.status}): ${msg}`);
  }

  return parseNanoImageResponse(json);
}
