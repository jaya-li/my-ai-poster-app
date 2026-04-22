import type { NanoReferenceImage } from "@/lib/nanobanana";
import { explainFetchFailure } from "@/lib/fetch-error";
import { getImageMimeFromBase64, stripDataUrlPrefix } from "@/lib/image";

const DOWNLOAD_MS = 120_000;

/** 将主视觉 URL 或 data URL 转为 Nanobanana 参考图条目 */
export async function urlToNanoReference(
  name: string,
  url: string
): Promise<NanoReferenceImage> {
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) {
    return {
      name,
      base64: stripDataUrlPrefix(trimmed),
      mimeType: getImageMimeFromBase64(trimmed),
    };
  }

  let res: Response;
  try {
    res = await fetch(trimmed, {
      signal: AbortSignal.timeout(DOWNLOAD_MS),
    });
  } catch (e) {
    throw new Error(
      explainFetchFailure(
        `下载主视觉失败（推广图需要把主视觉拉到服务器再传给 Nanobanana）。请确认链接未过期且本机可访问：${trimmed.slice(0, 96)}${trimmed.length > 96 ? "…" : ""}`,
        e
      )
    );
  }
  if (!res.ok) {
    throw new Error(`无法下载主视觉图片 (${res.status})，请确认 imageUrl 可访问`);
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    name,
    base64: buf.toString("base64"),
    mimeType: mime.startsWith("image/") ? mime : "image/png",
  };
}
