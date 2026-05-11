/**
 * 内置主视觉版式：`public/` 下的 PNG 与玩法对应关系见 `public/KV_ASSETS.md`（以仓库实际文件为准）。
 */
import { promises as fs } from "fs";
import path from "path";

export const KV_CAMPAIGN_TYPES = [
  "scan",
  "chongbang",
  "star_collect",
  "wheel",
  "tuijinbi",
  "baiyuan",
] as const;
export type KvCampaignType = (typeof KV_CAMPAIGN_TYPES)[number];

/** 扫码玩法：每次请求在下列文件中随机选 1 张作为图1 版式母版 */
export const BUILTIN_KV_SCAN_LAYOUTS = [
  "kv-layout-scan1.png",
  "kv-layout-scan2.png",
  "kv-layout-scan3.png",
] as const;

/** 冲榜玩法：同上 */
export const BUILTIN_KV_CHONGBANG_LAYOUTS = [
  "kv-layout-chongbang1.png",
  "kv-layout-chongbang2.png",
  "kv-layout-chongbang3.png",
] as const;

/**
 * 星星收集（集物入容器）：专用版式母版，每次生成主视觉请求在下列 3 张中**随机**选 1 张作为图1；
 * （单次 POST 若多方向，仍共用本次随机到的那一张，避免同批次 A/B/C/D 版式不一致。）
 */
export const BUILTIN_KV_STAR_COLLECT_LAYOUTS = [
  "kv-layout-xingxing1.png",
  "kv-layout-xingxing2.png",
  "kv-layout-xingxing3.png",
] as const;

/**
 * 转盘抽奖：专用版式母版，每次生成主视觉请求在下列 3 张中**随机**选 1 张作为图1；
 * （单次 POST 若多方向，仍共用本次随机到的那一张。）
 *
 * `kv-layout-zhuanpan2.png` 为巴西市场向母版（葡语 GIRO PREMIADO、热带绿调），
 * **仅在与巴西相关的生成语境**下参与随机；日本、韩国及其它非巴西语境从「不含 zhuanpan2」的子集中选取，见 {@link pickWheelBuiltinLayoutFilenameForContext}。
 */
export const BUILTIN_KV_WHEEL_LAYOUT_BRAZIL_ONLY = "kv-layout-zhuanpan2.png" as const;

export const BUILTIN_KV_WHEEL_LAYOUTS = [
  "kv-layout-zhuanpan1.png",
  BUILTIN_KV_WHEEL_LAYOUT_BRAZIL_ONLY,
  "kv-layout-zhuanpan3.png",
] as const;

/** 非巴西语境下仍可用的转盘内置母版（不含巴西专版 zhuanpan2） */
export const BUILTIN_KV_WHEEL_LAYOUTS_EXCLUDING_BRAZIL_MARKET = [
  "kv-layout-zhuanpan1.png",
  "kv-layout-zhuanpan3.png",
] as const;

/** 推金币：\`public/\` 四张竖版母版（纵向分区一致；奖格常见 -1 为 3×4，-2/-3/-4 多为 4×4，以图为准），每次随机 1 张作图1 */
export const BUILTIN_KV_TUIJINBI_LAYOUTS = [
  "kv-tuijinbi-1.png",
  "kv-tuijinbi-2.png",
  "kv-tuijinbi-3.png",
  "kv-tuijinbi-4.png",
] as const;

/** 百元玩法：专用版式母版，随机选 1 张作为图1 */
export const BUILTIN_KV_BAIYUAN_LAYOUTS = [
  "kv-layout-baiyuan1.png",
  "kv-layout-baiyuan2.png",
  "kv-layout-baiyuan3.png",
] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function builtinKvLayoutPool(campaign: KvCampaignType): readonly string[] {
  switch (campaign) {
    case "scan":
      return BUILTIN_KV_SCAN_LAYOUTS;
    case "chongbang":
      return BUILTIN_KV_CHONGBANG_LAYOUTS;
    case "star_collect":
      return BUILTIN_KV_STAR_COLLECT_LAYOUTS;
    case "wheel":
      return BUILTIN_KV_WHEEL_LAYOUTS;
    case "tuijinbi":
      return BUILTIN_KV_TUIJINBI_LAYOUTS;
    case "baiyuan":
      return BUILTIN_KV_BAIYUAN_LAYOUTS;
  }
}

/** 转盘生成：从主题与 wheel 参数推断是否允许使用巴西专版母版 zhuanpan2 */
export function isBrazilRelatedWheelContext(blob: string): boolean {
  const t = blob.toLowerCase();
  if (!t.trim()) return false;

  if (
    /\b(brazil|brasil|brasileira|brasileiro|brazilian|portuguese|português|portugues)\b/i.test(blob)
  )
    return true;
  if (/\b(rio de janeiro|são paulo|sao paulo|copacabana|amazonia|amazônia|nordeste)\b/i.test(t))
    return true;
  if (/\b(pt-br|pt_br)\b/i.test(t)) return true;
  if (/(^|[\s:：,，;；])pt([\s,，;；]|$)/i.test(t)) return true;
  if (/巴西|葡语|葡萄牙语|圣保罗|里约/i.test(blob)) return true;

  return false;
}

/**
 * 转盘：根据语境选取文件名；巴西相关时可从含 `zhuanpan2` 的全池随机，否则仅从 1/3 随机。
 */
export function pickWheelBuiltinLayoutFilenameForContext(blob: string): string {
  const pool = isBrazilRelatedWheelContext(blob)
    ? BUILTIN_KV_WHEEL_LAYOUTS
    : BUILTIN_KV_WHEEL_LAYOUTS_EXCLUDING_BRAZIL_MARKET;
  return pickRandom([...pool]);
}

export function pickBuiltinKvLayoutFilename(campaign: KvCampaignType, wheelLocaleBlob?: string): string {
  if (campaign === "wheel") {
    return pickWheelBuiltinLayoutFilenameForContext(wheelLocaleBlob ?? "");
  }
  return pickRandom(builtinKvLayoutPool(campaign));
}

/**
 * 读取 public 下随机选中的内置 KV 版式，返回 data URL（供 OpenAI / nanobanana）与文件名。
 * 单次 POST 内只调用一次，保证同一批多方向共用同一张母版。
 */
export async function loadBuiltinKvLayoutDataUrl(
  campaign: KvCampaignType,
  options?: { wheelLocaleBlob?: string }
): Promise<{
  dataUrl: string;
  filename: string;
}> {
  const filename = pickBuiltinKvLayoutFilename(campaign, options?.wheelLocaleBlob);
  const filePath = path.join(process.cwd(), "public", filename);
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    const expected = builtinKvLayoutPool(campaign);
    throw new Error(
      `缺少内置主视觉版式文件：public/${filename}。请将下列文件放入项目 public 目录：${[...expected].join("、")}`
    );
  }
  const base64 = buf.toString("base64");
  return { dataUrl: `data:image/png;base64,${base64}`, filename };
}
