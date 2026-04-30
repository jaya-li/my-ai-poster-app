import { promises as fs } from "fs";
import path from "path";

export const KV_CAMPAIGN_TYPES = ["scan", "chongbang", "star_collect", "wheel", "baiyuan"] as const;
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
 */
export const BUILTIN_KV_WHEEL_LAYOUTS = [
  "kv-layout-zhuanpan1.png",
  "kv-layout-zhuanpan2.png",
  "kv-layout-zhuanpan3.png",
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
    case "baiyuan":
      return BUILTIN_KV_BAIYUAN_LAYOUTS;
  }
}

export function pickBuiltinKvLayoutFilename(campaign: KvCampaignType): string {
  return pickRandom(builtinKvLayoutPool(campaign));
}

/**
 * 读取 public 下随机选中的内置 KV 版式，返回 data URL（供 OpenAI / nanobanana）与文件名。
 * 单次 POST 内只调用一次，保证同一批多方向共用同一张母版。
 */
export async function loadBuiltinKvLayoutDataUrl(campaign: KvCampaignType): Promise<{
  dataUrl: string;
  filename: string;
}> {
  const filename = pickBuiltinKvLayoutFilename(campaign);
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
