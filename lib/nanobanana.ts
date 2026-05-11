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

function closestAspectRatio(width: number, height: number): {
  label: string;
  ratio: number;
} {
  const target = width / height;
  let bestLabel: string = "1:1";
  let bestRatio = 1;
  let bestScore = Infinity;
  for (const ar of T8STAR_ASPECT_RATIOS) {
    const [a, b] = ar.split(":").map(Number);
    const r = a / b;
    const score = Math.abs(Math.log(r / target));
    if (score < bestScore) {
      bestScore = score;
      bestLabel = ar;
      bestRatio = r;
    }
  }
  return { label: bestLabel, ratio: bestRatio };
}

/**
 * T8Star 的 image_size 为粗粒度 1K/2K/4K；长边较高或画布面积较大时用 4K，减轻与目标像素对齐时的缩放损失。
 */
function imageSizeTierForCanvas(
  quality: "2k" | "standard" | undefined,
  width: number,
  height: number
): "1K" | "2K" | "4K" {
  if (quality === "standard") return "1K";
  const maxSide = Math.max(width, height);
  const area = width * height;
  if (maxSide >= 2400 || area >= 2_800_000) return "4K";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractNanoErrorPayload(json: unknown): { message: string; code: string } {
  if (!json || typeof json !== "object") {
    return { message: JSON.stringify(json), code: "" };
  }
  const o = json as Record<string, unknown>;
  const nested = o.error;
  if (nested && typeof nested === "object") {
    const e = nested as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : JSON.stringify(nested),
      code: typeof e.code === "string" ? e.code : "",
    };
  }
  return {
    message: typeof o.message === "string" ? o.message : JSON.stringify(json),
    code: typeof o.code === "string" ? o.code : "",
  };
}

/** 面向前端的可读错误（仍保留 status 供日志） */
export function formatNanoApiError(status: number, json: unknown): string {
  const { message, code } = extractNanoErrorPayload(json);
  const lower = `${code} ${message}`.toLowerCase();

  if (
    status === 503 &&
    (code === "system_memory_overloaded" ||
      lower.includes("memory overload") ||
      lower.includes("system memory"))
  ) {
    return (
      "生图服务当前负载过高（内存接近上限），已自动重试仍失败时请隔几分钟再试；" +
      "建议一次只选 1 个方向生成，或减少参考图张数/尺寸。"
    );
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "生图请求过于频繁，请稍后再试。";
  }
  if (status === 502 || status === 504) {
    return `生图网关暂时不可用（HTTP ${status}），请稍后重试。详情：${message}`;
  }
  return `Nanobanana API error (${status}): ${message || JSON.stringify(json)}`;
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_NANO_ATTEMPTS = 4;

export async function generateNanoImage(params: {
  prompt: string;
  /** 目标画布宽（主视觉应与 `lib/kv-campaign-output-size` 约定一致） */
  width: number;
  /** 目标画布高 */
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

  /** 与 T8Star 约定：aspect_ratio + image_size；另附目标像素供网关/模型侧解析（与 ComfyUI Tutu 节点行为对齐时可读） */
  const aspect = closestAspectRatio(params.width, params.height);
  const imageSize = imageSizeTierForCanvas(params.quality, params.width, params.height);

  /** 设为 `0` / `false` 时不下发额外宽高校验字段（上游若严格校验 body 可能拒收未知键） */
  const sendExactDimensions =
    (process.env.NANOBANANA_SEND_EXACT_DIMENSIONS ?? "1").trim().toLowerCase() !== "0" &&
    (process.env.NANOBANANA_SEND_EXACT_DIMENSIONS ?? "1").trim().toLowerCase() !== "false";

  /**
   * 输出尺寸 footer：明确告诉模型最终目标画幅 + 引擎档位 + 后处理策略，
   * 让模型按目标比例构图（不被引擎档位带偏）。后处理用 contain + 模糊背景，**不会裁切**任何内容。
   */
  const targetRatio = params.width / params.height;
  const targetRatioStr = `${params.width}:${params.height}（≈ ${targetRatio.toFixed(3)}:1，宽:高）`;
  const orientationWord =
    targetRatio < 0.7 ? "**瘦高竖版**" : targetRatio > 1.4 ? "**横版**" : "近方形";

  const aspectMismatch =
    Math.abs(Math.log(aspect.ratio / targetRatio)) >= 0.06;
  const mismatchHint = aspectMismatch
    ? ` 由于引擎档位 ${aspect.label} 与目标比例略有失配，最终成片在 ${
        aspect.ratio > targetRatio ? "**左右两侧**" : "**上下两条**"
      }会出现少量「模糊延伸背景」用于铺底；因此请把图1 中**所有 UI/按钮/IP/二维码/标题文字**画进画面的**主体可读区**，**不要把按钮或文字贴到画布最边缘**——上游模型实际出图按 ${aspect.label} 比例即可，无需自行加裁边或延伸内容；后处理会把整张完整收进 ${params.width}×${params.height} 画布且**不会裁切**任何像素。`
    : "";

  const outputSizeFooter =
    `\n\n【最高优先级 — 版式几何复刻】` +
    `图 1 是版式母版，**不是灵感参考**。成片必须像把图 1 的设计稿"逐图层换皮"——只换主题色、插画/角色和文字本地化，` +
    `**禁止**重排、合并、拆分、删除/新增模块，**禁止**改任何模块的相对位置/尺寸/留白；` +
    `检验标准：成片与图 1 叠在一起，所有模块（顶栏/中部主体/底部按钮/二维码或扫码入口/外框/灯带/装饰边）应**几何骨架完全重合**，只有像素皮肤换掉。` +
    `\n\n【成片画幅】` +
    `${orientationWord}海报，最终像素严格 **${params.width}×${params.height}**（${targetRatioStr}）；` +
    `所有版式思考都直接基于这张 ${params.width}×${params.height} 画布；` +
    `不在画面中央显示 W×H 数字或测距标尺。` +
    mismatchHint;

  const body: Record<string, unknown> = {
    model,
    prompt: `${params.prompt.trim()}${outputSizeFooter}`,
    aspect_ratio: aspect.label,
    image_size: imageSize,
    response_format: "url",
  };

  if (sendExactDimensions) {
    body.width = params.width;
    body.height = params.height;
    body.target_width = params.width;
    body.target_height = params.height;
    body.output_dimensions = {
      width: params.width,
      height: params.height,
    };
  }

  const refs = params.referenceImages?.filter((r) => r.base64?.length) ?? [];
  if (refs.length > 0) {
    body.image = referenceToDataUris(refs);
  }

  const payload = JSON.stringify(body);

  for (let attempt = 1; attempt <= MAX_NANO_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: payload,
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

    if (res.ok) {
      return parseNanoImageResponse(json);
    }

    const canRetry =
      RETRYABLE_STATUS.has(res.status) && attempt < MAX_NANO_ATTEMPTS;
    if (canRetry) {
      const base = 3500 * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 1500);
      await sleep(base + jitter);
      continue;
    }

    throw new Error(formatNanoApiError(res.status, json));
  }

  throw new Error("Nanobanana：内部错误（重试循环未返回）");
}
