/** 解析 API JSON；非 JSON（如 Vercel 413 纯文本）时给出可读错误 */
export async function parseApiJson<T extends Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    const is413 =
      res.status === 413 ||
      /request entity too large/i.test(text) ||
      /^request en/i.test(text.trim());
    throw new Error(
      is413
        ? "上传数据过大（Vercel 单次请求约 4.5MB）。请换更小的参考图或减少同时上传张数；页面已自动压缩，若仍失败请把图片压到长边约 2000px 以内再试。"
        : text.trim().slice(0, 400) || `服务器返回非 JSON（HTTP ${res.status}）`
    );
  }
  if (!res.ok) {
    const rec = data as unknown as Record<string, unknown>;
    const msg =
      typeof rec.error === "string" || typeof rec.error === "number"
        ? String(rec.error)
        : `请求失败（${res.status}）`;
    throw new Error(msg);
  }
  return data;
}
