import type { KvCampaignType } from "@/lib/kv-layout-builtin";

export type KvSplitLayerKey =
  | "background"
  | "subject"
  | "others"
  | "seven_rewards"
  | "podium"
  | "wheel_body_and_peripherals"
  | "bottom_buttons";

export type KvSplitReferenceConfig = {
  filename: string;
  layers: KvSplitLayerKey[];
};

/** 拆图参考配置（按玩法）：仅用于定义拆分边界，不可替换当前主视觉内容。 */
export const KV_SPLIT_REFERENCE_BY_CAMPAIGN: Partial<Record<KvCampaignType, KvSplitReferenceConfig>> = {
  scan: {
    filename: "saoma-chaitu.png",
    layers: ["background", "subject", "others"],
  },
  chongbang: {
    filename: "chongbang-chaitu.png",
    layers: ["background", "seven_rewards", "podium"],
  },
  wheel: {
    filename: "chaitu-zhuanpan.png",
    layers: ["background", "wheel_body_and_peripherals", "bottom_buttons"],
  },
};

