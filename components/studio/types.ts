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
  prompt: string;
  selected: boolean;
  anchorFocused: boolean;
  onOpenPromo: () => void;
  refineDraft: string;
  onRefineDraftChange: (v: string) => void;
  onRefine: () => void;
  refineBusy: boolean;
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
