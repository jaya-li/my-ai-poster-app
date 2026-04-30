import type { CSSProperties } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { DirKey } from "@/components/studio/types";
import type { StudioThreadState, StudioVisualSnapshot } from "@/lib/studio/studio-thread-state";

/** 对齐 Figma 画布连线：浅灰细线 */
const studioEdgeStyle: CSSProperties = {
  stroke: "rgba(255,255,255,0.22)",
  strokeWidth: 1.5,
};

function makeStudioEdge(
  id: string,
  source: string,
  target: string,
  opts?: { animated?: boolean }
): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style: studioEdgeStyle,
    animated: opts?.animated ?? false,
  };
}

export type StudioThreadRefining = null | { kind: "kv" | "banner"; threadId: string; key: DirKey };

export type BuildThreadGraphCallbacks = {
  toggleDirection: (threadId: string, key: DirKey) => void;
  onKvOpenPromo: (threadId: string, key: DirKey) => void;
  onSelectCopy: (threadId: string, key: DirKey) => void;
  onBannerSelect: (threadId: string, key: DirKey) => void;
  onDirectionCommit: (threadId: string, key: DirKey, patch: { title?: string; content?: string }) => void;
  onPromoCopyCommit: (
    threadId: string,
    key: DirKey,
    patch: { headline?: string; subheadline?: string; description?: string }
  ) => void;
  bumpKvHistory: (threadId: string, key: DirKey, delta: number) => void;
  bumpBannerHistory: (threadId: string, key: DirKey, delta: number) => void;
  setKvRefineDraft: (threadId: string, key: DirKey, v: string) => void;
  setBannerRefineDraft: (threadId: string, key: DirKey, v: string) => void;
  refineKv: (threadId: string, key: DirKey) => void | Promise<void>;
  refineBanner: (threadId: string, key: DirKey) => void | Promise<void>;
};

type PromoCopyShape = NonNullable<StudioThreadState["promoCopyByKey"][DirKey]>;
type PromoBannerShape = NonNullable<StudioThreadState["promoBannerByKey"][DirKey]>;

export function buildStudioThreadGraph(
  threadId: string,
  thread: StudioThreadState,
  focusedNodeId: string | null,
  studioRefining: StudioThreadRefining,
  callbacks: BuildThreadGraphCallbacks
): { nodes: Node[]; edges: Edge[] } {
  const {
    themeDraft,
    committedTheme,
    promptStatus,
    promptError,
    options,
    selected,
    suppressedDirKeys,
    results,
    selectedKvKey,
    selectedCopyKey,
    promoCopyByKey,
    promoBannerByKey,
    kvSlots,
    promoBannerSlots,
    kvRefineDraftByKey,
    bannerRefineDraftByKey,
  } = thread;

  const suppressed = new Set(suppressedDirKeys);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const pointerAll = { pointerEvents: "all" as const };

  const promptNodeId = `prompt-${threadId}`;

  const displayLabel =
    committedTheme?.trim() ||
    themeDraft.trim() ||
    "在附着面板填写主题，点「生成」得到四方向";

  nodes.push({
    id: promptNodeId,
    type: "prompt",
    position: { x: 0, y: 0 },
    style: pointerAll,
    data: {
      label: displayLabel,
      status: committedTheme ? promptStatus : "idle",
      errorMessage: committedTheme ? promptError : undefined,
      anchorFocused: focusedNodeId === promptNodeId,
    },
  });

  if (!committedTheme) {
    return { nodes, edges };
  }

  for (const opt of options) {
    if (suppressed.has(opt.key)) continue;
    const id = `dir-${threadId}-${opt.key}`;
    nodes.push({
      id,
      type: "direction",
      position: { x: 0, y: 0 },
      style: pointerAll,
      data: {
        ...opt,
        selected: selected.includes(opt.key),
        anchorFocused: focusedNodeId === id,
        onToggle: () => callbacks.toggleDirection(threadId, opt.key),
        onOptionCommit: (patch: { title?: string; content?: string }) =>
          callbacks.onDirectionCommit(threadId, opt.key, patch),
      },
    });
    edges.push(
      makeStudioEdge(`e-${threadId}-p-${opt.key}`, promptNodeId, id, {
        animated: promptStatus === "loading",
      })
    );
  }

  for (const r of results) {
    if (suppressed.has(r.optionKey)) continue;
    const dirId = `dir-${threadId}-${r.optionKey}`;
    const kvId = `kv-${threadId}-${r.optionKey}`;

    const kvSlot = kvSlots[r.optionKey];
    const kvFallback: StudioVisualSnapshot = {
      imageUrl: r.imageUrl,
      width: r.width,
      height: r.height,
      prompt: r.prompt,
    };
    const kvHistList = kvSlot?.history?.length ? kvSlot.history : [kvFallback];
    const kvIdx = kvSlot
      ? Math.max(0, Math.min(kvHistList.length - 1, kvSlot.index))
      : 0;
    const kvSnap = kvHistList[kvIdx] ?? kvFallback;
    const kvDisplayUrl = kvSnap.imageUrl;
    const kvDisplayPrompt = kvSnap.prompt;
    const kvHist = kvHistList.length;

    nodes.push({
      id: kvId,
      type: "kvResult",
      position: { x: 0, y: 0 },
      style: pointerAll,
      data: {
        optionKey: r.optionKey,
        imageUrl: kvDisplayUrl,
        prompt: kvDisplayPrompt,
        selected: selectedKvKey === r.optionKey,
        anchorFocused: focusedNodeId === kvId,
        onOpenPromo: () => callbacks.onKvOpenPromo(threadId, r.optionKey),
        refineDraft: kvRefineDraftByKey[r.optionKey] ?? "",
        onRefineDraftChange: (v: string) => callbacks.setKvRefineDraft(threadId, r.optionKey, v),
        onRefine: () => callbacks.refineKv(threadId, r.optionKey),
        refineBusy:
          studioRefining?.kind === "kv" &&
          studioRefining.threadId === threadId &&
          studioRefining.key === r.optionKey,
        historyCount: kvHist,
        historyIndex: kvIdx,
        onHistoryPrev: () => callbacks.bumpKvHistory(threadId, r.optionKey, -1),
        onHistoryNext: () => callbacks.bumpKvHistory(threadId, r.optionKey, 1),
      },
    });
    edges.push(makeStudioEdge(`e-${threadId}-dk-${r.optionKey}`, dirId, kvId));

    const copyData = promoCopyByKey[r.optionKey] as PromoCopyShape | undefined;
    if (copyData) {
      const copyId = `copy-${threadId}-${r.optionKey}`;
      nodes.push({
        id: copyId,
        type: "promoCopy",
        position: { x: 0, y: 0 },
        style: pointerAll,
        data: {
          optionKey: r.optionKey,
          headline: copyData.headline,
          subheadline: copyData.subheadline,
          description: copyData.description,
          selected: selectedCopyKey === r.optionKey,
          anchorFocused: focusedNodeId === copyId,
          onSelect: () => callbacks.onSelectCopy(threadId, r.optionKey),
          onPromoCopyCommit: (patch: {
            headline?: string;
            subheadline?: string;
            description?: string;
          }) => callbacks.onPromoCopyCommit(threadId, r.optionKey, patch),
        },
      });
      edges.push(makeStudioEdge(`e-${threadId}-kc-${r.optionKey}`, kvId, copyId));
    }

    const bannerData = promoBannerByKey[r.optionKey] as PromoBannerShape | undefined;
    if (bannerData && copyData) {
      const copyId = `copy-${threadId}-${r.optionKey}`;
      const bannerId = `banner-${threadId}-${r.optionKey}`;
      const bSlot = promoBannerSlots[r.optionKey];
      const bFallback: StudioVisualSnapshot = {
        imageUrl: bannerData.imageUrl,
        width: bannerData.width,
        height: bannerData.height,
        prompt: bannerData.prompt,
      };
      const bHistList = bSlot?.history?.length ? bSlot.history : [bFallback];
      const bIdx = bSlot
        ? Math.max(0, Math.min(bHistList.length - 1, bSlot.index))
        : 0;
      const bSnap = bHistList[bIdx] ?? bFallback;
      const bUrl = bSnap.imageUrl;
      const bW = bSnap.width;
      const bH = bSnap.height;
      const bHist = bHistList.length;

      nodes.push({
        id: bannerId,
        type: "promoBanner",
        position: { x: 0, y: 0 },
        style: pointerAll,
        data: {
          optionKey: r.optionKey,
          imageUrl: bUrl,
          width: bW,
          height: bH,
          selected: focusedNodeId === bannerId,
          anchorFocused: focusedNodeId === bannerId,
          onSelect: () => callbacks.onBannerSelect(threadId, r.optionKey),
          refineDraft: bannerRefineDraftByKey[r.optionKey] ?? "",
          onRefineDraftChange: (v: string) =>
            callbacks.setBannerRefineDraft(threadId, r.optionKey, v),
          onRefine: () => callbacks.refineBanner(threadId, r.optionKey),
          refineBusy:
            studioRefining?.kind === "banner" &&
            studioRefining.threadId === threadId &&
            studioRefining.key === r.optionKey,
          historyCount: bHist,
          historyIndex: bIdx,
          onHistoryPrev: () => callbacks.bumpBannerHistory(threadId, r.optionKey, -1),
          onHistoryNext: () => callbacks.bumpBannerHistory(threadId, r.optionKey, 1),
        },
      });
      edges.push(makeStudioEdge(`e-${threadId}-cb-${r.optionKey}`, copyId, bannerId));
    }
  }

  return { nodes, edges };
}

export function mergeStudioThreadGraphs(
  threadOrder: string[],
  threads: Record<string, StudioThreadState>,
  focusedNodeId: string | null,
  studioRefining: StudioThreadRefining,
  callbacks: BuildThreadGraphCallbacks
): { nodes: Node[]; edges: Edge[] } {
  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];
  for (const tid of threadOrder) {
    const t = threads[tid];
    if (!t) continue;
    const { nodes, edges } = buildStudioThreadGraph(tid, t, focusedNodeId, studioRefining, callbacks);
    allNodes.push(...nodes);
    allEdges.push(...edges);
  }
  return { nodes: allNodes, edges: allEdges };
}
