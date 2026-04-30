import type { DirectionOption, GeneratedImageResult } from "@/lib/types";
import type { DirKey } from "@/components/studio/types";

export const STUDIO_MAIN_THREAD_ID = "main";

export type PromptStatus = "idle" | "loading" | "done" | "error";

export type StudioVisualSnapshot = {
  imageUrl: string;
  width: number;
  height: number;
  prompt: string;
};

export type StudioVisualSlot = {
  history: StudioVisualSnapshot[];
  index: number;
};

export type StudioThreadState = {
  themeDraft: string;
  committedTheme: string | null;
  promptStatus: PromptStatus;
  promptError?: string;
  options: DirectionOption[];
  selected: DirKey[];
  suppressedDirKeys: DirKey[];
  results: GeneratedImageResult[];
  selectedKvKey: DirKey | null;
  selectedCopyKey: DirKey | null;
  promoCopyByKey: Partial<
    Record<
      DirKey,
      {
        headline: string;
        subheadline: string;
        description: string;
        raw?: string;
      }
    >
  >;
  promoBannerByKey: Partial<
    Record<
      DirKey,
      {
        prompt: string;
        imageUrl: string;
        width: number;
        height: number;
      }
    >
  >;
  kvSlots: Partial<Record<DirKey, StudioVisualSlot>>;
  promoBannerSlots: Partial<Record<DirKey, StudioVisualSlot>>;
  kvRefineDraftByKey: Partial<Record<DirKey, string>>;
  bannerRefineDraftByKey: Partial<Record<DirKey, string>>;
};

export function emptyStudioThreadState(): StudioThreadState {
  return {
    themeDraft: "",
    committedTheme: null,
    promptStatus: "idle",
    promptError: undefined,
    options: [],
    selected: [],
    suppressedDirKeys: [],
    results: [],
    selectedKvKey: null,
    selectedCopyKey: null,
    promoCopyByKey: {},
    promoBannerByKey: {},
    kvSlots: {},
    promoBannerSlots: {},
    kvRefineDraftByKey: {},
    bannerRefineDraftByKey: {},
  };
}

/** 仅含 [a-z0-9]，避免节点 id 解析歧义 */
export function makeStudioThreadId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}
