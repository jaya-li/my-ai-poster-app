import type { KvCampaignType } from "@/lib/kv-layout-builtin";

/**
 * 各玩法主视觉成片与 Nanobanana 请求使用的约定像素尺寸（与产品规格一致）。
 * 内置/上传版式参考图仅作构图参考；实际输出宽高以此表为准。
 */
export const KV_CAMPAIGN_OUTPUT_PX: Record<
  KvCampaignType,
  Readonly<{ width: number; height: number }>
> = {
  scan: { width: 1200, height: 1908 },
  chongbang: { width: 1125, height: 2841 },
  star_collect: { width: 1642, height: 2398 },
  wheel: { width: 1560, height: 3376 },
  tuijinbi: { width: 1170, height: 2532 },
  baiyuan: { width: 1098, height: 1290 },
};

export function getKvCampaignOutputPixels(campaign: KvCampaignType): {
  width: number;
  height: number;
} {
  return KV_CAMPAIGN_OUTPUT_PX[campaign];
}
