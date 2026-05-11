import type { Node } from "@xyflow/react";
import type { DirectionOption } from "@/lib/types";

export type DirKey = "A" | "B" | "C" | "D";

export type PromptNodeData = {
  label: string;
  status: "idle" | "loading" | "done" | "error";
  errorMessage?: string;
  /** 当前附着面板所对应的节点（点击高亮） */
  anchorFocused: boolean;
};

export type DirectionNodeData = DirectionOption & {
  selected: boolean;
  anchorFocused: boolean;
  onToggle: () => void;
  onOptionCommit: (patch: { title?: string; content?: string }) => void;
};

export type KvResultNodeData = {
  optionKey: DirKey;
  imageUrl: string;
  /** 与 API 归一化后的成片像素，用于导出文件名等 */
  width: number;
  height: number;
  prompt: string;
  selected: boolean;
  anchorFocused: boolean;
  /** 打开「写文案」弹窗（generate-copy） */
  onOpenPromo: () => void;
  /** 点击主图：展开右侧附着面板并进入改图输入 */
  onActivateEditPanel: () => void;
  /** 改图 / 去 UI / 拆图进行中 */
  adjustmentBusy: boolean;
  onRemoveUi: () => void;
  removeUiBusy: boolean;
  splitLayers: Array<{ key: string; label: string; imageUrl: string }>;
  historyCount: number;
  historyIndex: number;
  onHistoryPrev: () => void;
  onHistoryNext: () => void;
};

export type PromoCopyNodeData = {
  optionKey: DirKey;
  headline: string;
  subheadline: string;
  description: string;
  selected: boolean;
  anchorFocused: boolean;
  onSelect: () => void;
  onPromoCopyCommit: (patch: { headline?: string; subheadline?: string; description?: string }) => void;
};

export type PromoBannerNodeData = {
  optionKey: DirKey;
  imageUrl: string;
  width: number;
  height: number;
  selected: boolean;
  anchorFocused: boolean;
  onSelect: () => void;
  refineDraft: string;
  onRefineDraftChange: (v: string) => void;
  onRefine: () => void;
  refineBusy: boolean;
  historyCount: number;
  historyIndex: number;
  onHistoryPrev: () => void;
  onHistoryNext: () => void;
};

export type PromptRFNode = Node<PromptNodeData, "prompt">;
export type DirectionRFNode = Node<DirectionNodeData, "direction">;
export type KvResultRFNode = Node<KvResultNodeData, "kvResult">;
export type PromoCopyRFNode = Node<PromoCopyNodeData, "promoCopy">;
export type PromoBannerRFNode = Node<PromoBannerNodeData, "promoBanner">;
export type StudioRFNode =
  | PromptRFNode
  | DirectionRFNode
  | KvResultRFNode
  | PromoCopyRFNode
  | PromoBannerRFNode;
