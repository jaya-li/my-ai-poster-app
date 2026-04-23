import type { Node } from "@xyflow/react";
import type { DirectionOption } from "@/lib/types";

export type DirKey = "A" | "B" | "C" | "D";

export type PromptNodeData = {
  label: string;
  status: "idle" | "loading" | "done" | "error";
  errorMessage?: string;
};

export type DirectionNodeData = DirectionOption & {
  selected: boolean;
  onToggle: () => void;
};

export type KvResultNodeData = {
  optionKey: DirKey;
  imageUrl: string;
  prompt: string;
  selected: boolean;
  onSelect: () => void;
};

export type PromoCopyNodeData = {
  optionKey: DirKey;
  headline: string;
  subheadline: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export type PromoBannerNodeData = {
  optionKey: DirKey;
  imageUrl: string;
  width: number;
  height: number;
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
