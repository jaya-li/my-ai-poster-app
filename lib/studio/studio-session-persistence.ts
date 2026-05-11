/**
 * 画布会话：防抖写入 sessionStorage + 离开页面前同步写入，
 * 缓解触控板/后退手势意外离开导致内容丢失。
 * 上传的本地 File 无法序列化，刷新后仅能恢复文字与远程图 URL。
 */
import type { KvCampaignType } from "@/lib/kv-layout-builtin";
import {
  emptyStudioThreadState,
  STUDIO_MAIN_THREAD_ID,
  type StudioThreadState,
} from "@/lib/studio/studio-thread-state";

export const STUDIO_AUTOSAVE_STORAGE_KEY = "studio-canvas-autosave-v1";

/** layout dataURL 过大时不再写入 autosave（避免配额溢出）；用户需重新点「生成 prompt」 */
export const STUDIO_AUTOSAVE_MAX_LAYOUT_BASE64_CHARS = 750_000;

export type StudioCanvasMode = "agent" | "custom";

export type CustomModePhasePersisted = "input" | "pe-ready";

/** 与子组件一致的玩法 radio 字面量集合 */
export type StudioKvCampaignTypeUi =
  | "scan"
  | "chongbang"
  | "star_collect"
  | "wheel"
  | "tuijinbi"
  | "baiyuan";

export type PersistedKvSpecForms = {
  chongbang: {
    targetLanguage: string;
    scene: string;
    rewardItems: string;
    decorativeElements: string;
    primaryColor: string;
    mascotBrief: string;
    coinVariation: string;
    moodKeywords: string;
  };
  starCollect: {
    targetLanguage: string;
    collectible: string;
    container: string;
    scene: string;
    decorativeElements: string;
    primaryColor: string;
    ipBrief: string;
    coinVariation: string;
    moodKeywords: string;
  };
  wheel: {
    targetLanguage: string;
    scene: string;
    prizeElements: string;
    decorativeElements: string;
    primaryColor: string;
    ipBrief: string;
    coinVariation: string;
    moodKeywords: string;
  };
  tuijinbi: {
    targetLanguage: string;
    scene: string;
    projectileBrief: string;
    gridThemeBrief: string;
    prizeElements: string;
    decorativeElements: string;
    primaryColor: string;
    ipBrief: string;
    coinVariation: string;
    moodKeywords: string;
  };
};

export type CustomPeMetaPersisted = {
  layoutBase64: string;
  width: number;
  height: number;
  campaignType: KvCampaignType;
  kvLayoutTemplate?: string;
};

export type StudioAutosaveV1 = {
  v: 1;
  savedAt: number;
  threads: Record<string, StudioThreadState>;
  threadOrder: string[];
  preferredAnchorId: string | null;
  kvCampaignType: StudioKvCampaignTypeUi;
  specForms: PersistedKvSpecForms;
  canvasMode: StudioCanvasMode;
  customPhase: CustomModePhasePersisted;
  customIdea: string;
  /** 与子组件保持一致 */
  customCampaignType: KvCampaignType;
  customDraftedPrompt: string;
  customPeMeta: CustomPeMetaPersisted | null;
};

function normalizeThreadOrder(
  threads: Record<string, StudioThreadState>,
  order: string[]
): string[] {
  const uniq = [...new Set(order.filter((id) => threads[id]))];
  if (!uniq.includes(STUDIO_MAIN_THREAD_ID) && threads[STUDIO_MAIN_THREAD_ID]) {
    uniq.unshift(STUDIO_MAIN_THREAD_ID);
  }
  if (uniq.length === 0 && threads[STUDIO_MAIN_THREAD_ID]) {
    return [STUDIO_MAIN_THREAD_ID];
  }
  return uniq;
}

/** 判断是否接近「空仓」的一条 thread（未完成主题 / 方案 / 出图等业务） */
function isThreadStillBlank(t: StudioThreadState): boolean {
  const hasTheme =
    (t.themeDraft?.trim()?.length ?? 0) > 0 || Boolean(t.committedTheme?.trim());
  const hasOptions = t.options.length > 0;
  const hasResults = t.results.length > 0;
  const hasPromoWork =
    Object.keys(t.promoCopyByKey ?? {}).length > 0 ||
    Object.keys(t.promoBannerByKey ?? {}).length > 0;
  const hasKvWork = Object.keys(t.kvSlots ?? {}).length > 0 || hasResults;
  return !hasTheme && !hasOptions && !hasKvWork && !hasPromoWork;
}

/**
 * 有「值得一提」的非空画布内容或与初始态不同的自定义草稿时视为「脏」，
 * beforeunload / 站内跳转前先确认。
 */
export function computeStudioAutosaveDirty(s: Omit<StudioAutosaveV1, "v" | "savedAt">): boolean {
  const ids = Object.keys(s.threads);
  const multipleThreads =
    ids.length > 1 || (ids.length === 1 && ids[0] !== STUDIO_MAIN_THREAD_ID);

  if (multipleThreads) return true;

  const main = s.threads[STUDIO_MAIN_THREAD_ID] ?? emptyStudioThreadState();

  const specHasText = (() => {
    const v = (x: Record<string, string>) =>
      Object.values(x).some((t) => typeof t === "string" && t.trim().length > 0);
    return (
      v(s.specForms.chongbang as unknown as Record<string, string>) ||
      v(s.specForms.starCollect as unknown as Record<string, string>) ||
      v(s.specForms.wheel as unknown as Record<string, string>) ||
      v(s.specForms.tuijinbi as unknown as Record<string, string>)
    );
  })();

  if (specHasText || s.kvCampaignType !== "scan") return true;

  const customMessy =
    s.customPhase === "pe-ready" ||
    s.customIdea.trim().length > 0 ||
    s.customDraftedPrompt.trim().length > 0 ||
    Boolean(s.customPeMeta) ||
    s.customCampaignType !== "scan";

  if (customMessy || s.canvasMode !== "agent") return true;

  if (!isThreadStillBlank(main)) return true;

  return false;
}

function trimPeMeta(meta: CustomPeMetaPersisted | null): CustomPeMetaPersisted | null {
  if (!meta) return null;
  if (
    typeof meta.layoutBase64 === "string" &&
    meta.layoutBase64.length > STUDIO_AUTOSAVE_MAX_LAYOUT_BASE64_CHARS
  ) {
    return null;
  }
  return meta;
}

export function buildStudioAutosaveV1(slice: Omit<StudioAutosaveV1, "v" | "savedAt">): StudioAutosaveV1 {
  const meta = trimPeMeta(slice.customPeMeta);
  let phase = slice.customPhase;
  let drafted = slice.customDraftedPrompt;
  if (!meta && slice.customPhase === "pe-ready") {
    phase = "input";
    drafted = "";
  }

  const threads = { ...slice.threads };
  const threadOrder = normalizeThreadOrder(threads, slice.threadOrder);

  return {
    v: 1,
    savedAt: Date.now(),
    ...slice,
    threads,
    threadOrder,
    preferredAnchorId: slice.preferredAnchorId,
    customPeMeta: meta,
    customPhase: phase,
    customDraftedPrompt: drafted,
  };
}

export function writeStudioAutosave(payload: StudioAutosaveV1): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STUDIO_AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota or private mode — 静默失败 */
  }
}

/** 刷新后尝试恢复客户端状态 */
export function readStudioHydrateBootstrap(): Omit<StudioAutosaveV1, "v" | "savedAt"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STUDIO_AUTOSAVE_STORAGE_KEY);
    if (!raw?.trim()) return null;
    const p = JSON.parse(raw) as StudioAutosaveV1;
    if (p?.v !== 1 || !p.threads || !Array.isArray(p.threadOrder)) return null;

    const threads = p.threads as Record<string, StudioThreadState>;
    const threadOrder = normalizeThreadOrder(threads, p.threadOrder ?? []);
    if (threadOrder.length === 0) return null;

    let customPeMeta = trimPeMeta(p.customPeMeta ?? null);
    let customPhase: CustomModePhasePersisted =
      p.customPhase === "pe-ready" ? "pe-ready" : "input";
    let customDraftedPrompt = typeof p.customDraftedPrompt === "string" ? p.customDraftedPrompt : "";
    const customIdea = typeof p.customIdea === "string" ? p.customIdea : "";

    if (!customPeMeta && customPhase === "pe-ready") {
      customPhase = "input";
      customDraftedPrompt = "";
      customPeMeta = null;
    }

    return {
      threads,
      threadOrder,
      preferredAnchorId:
        typeof p.preferredAnchorId === "string" || p.preferredAnchorId === null
          ? p.preferredAnchorId
          : `prompt-${STUDIO_MAIN_THREAD_ID}`,
      kvCampaignType:
        typeof p.kvCampaignType === "string" ? p.kvCampaignType : ("scan" as StudioKvCampaignTypeUi),
      specForms: normalizeSpecForms(p.specForms),
      canvasMode: p.canvasMode === "custom" ? "custom" : "agent",
      customPhase,
      customIdea,
      customCampaignType:
        typeof p.customCampaignType === "string"
          ? (p.customCampaignType as KvCampaignType)
          : "scan",
      customDraftedPrompt,
      customPeMeta,
    };
  } catch {
    return null;
  }
}

function normalizeSpecForms(
  raw: unknown
): StudioAutosaveV1["specForms"] {
  /* 缺字段时用空串补齐，防止受控组件 undefined */
  const z = (): string => "";

  type R = PersistedKvSpecForms;
  const fallback: R = {
    chongbang: {
      targetLanguage: z(),
      scene: z(),
      rewardItems: z(),
      decorativeElements: z(),
      primaryColor: z(),
      mascotBrief: z(),
      coinVariation: z(),
      moodKeywords: z(),
    },
    starCollect: {
      targetLanguage: z(),
      collectible: z(),
      container: z(),
      scene: z(),
      decorativeElements: z(),
      primaryColor: z(),
      ipBrief: z(),
      coinVariation: z(),
      moodKeywords: z(),
    },
    wheel: {
      targetLanguage: z(),
      scene: z(),
      prizeElements: z(),
      decorativeElements: z(),
      primaryColor: z(),
      ipBrief: z(),
      coinVariation: z(),
      moodKeywords: z(),
    },
    tuijinbi: {
      targetLanguage: z(),
      scene: z(),
      projectileBrief: z(),
      gridThemeBrief: z(),
      prizeElements: z(),
      decorativeElements: z(),
      primaryColor: z(),
      ipBrief: z(),
      coinVariation: z(),
      moodKeywords: z(),
    },
  };

  if (!raw || typeof raw !== "object") return fallback;
  const src = raw as Partial<R>;

  const merge = <T extends Record<string, string>>(base: T, patch?: Partial<T> | undefined): T => {
    const out = { ...base };
    if (!patch || typeof patch !== "object") return out;
    (Object.keys(out) as (keyof T)[]).forEach((k) => {
      const vv = patch[k];
      out[k] = (typeof vv === "string" ? vv : out[k]) as T[keyof T];
    });
    return out;
  };

  return {
    chongbang: merge(fallback.chongbang, src.chongbang as R["chongbang"] | undefined),
    starCollect: merge(fallback.starCollect, src.starCollect as R["starCollect"] | undefined),
    wheel: merge(fallback.wheel, src.wheel as R["wheel"] | undefined),
    tuijinbi: merge(fallback.tuijinbi, src.tuijinbi as R["tuijinbi"] | undefined),
  };
}
