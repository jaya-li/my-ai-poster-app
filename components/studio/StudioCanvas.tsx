"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FourPointStarIcon } from "@/components/icons/FourPointStarIcon";
import { FlowNotice } from "@/components/FlowNotice";
import {
  StudioPanelAnchorBridge,
  type StudioPanelAnchorPayload,
} from "@/components/studio/StudioPanelAnchorBridge";
import { compressIpRefFile, compressRefFile } from "@/lib/client-image";
import { layoutStudioNodes } from "@/lib/studio/layout-graph";
import { parseApiJson } from "@/lib/parse-api-response";
import { STUDIO_ACCENT_RGB } from "@/lib/studio/studio-accent";
import {
  mergeStudioThreadGraphs,
  type StudioThreadRefining,
} from "@/lib/studio/build-studio-thread-graph";
import { parseStudioAnchor, dirKeyFromStudioNodeId } from "@/lib/studio/parse-studio-anchor";
import {
  emptyStudioThreadState,
  makeStudioThreadId,
  STUDIO_MAIN_THREAD_ID,
  type StudioThreadState,
  type StudioVisualSnapshot,
} from "@/lib/studio/studio-thread-state";
import type { ChongbangKvSpec, StarCollectKvSpec, WheelKvSpec } from "@/lib/prompts";
import type { DirectionOption, GeneratedImageResult } from "@/lib/types";
import { DirectionNode } from "./nodes/DirectionNode";
import { KvResultNode } from "./nodes/KvResultNode";
import { PromoBannerNode } from "./nodes/PromoBannerNode";
import { PromoCopyNode } from "./nodes/PromoCopyNode";
import { PromptNode } from "./nodes/PromptNode";
import type { DirKey } from "./types";

const nodeTypes = {
  prompt: PromptNode,
  direction: DirectionNode,
  kvResult: KvResultNode,
  promoCopy: PromoCopyNode,
  promoBanner: PromoBannerNode,
};

type RefImageSlot = "style" | "ip" | "coin";

type PromoCopy = {
  headline: string;
  subheadline: string;
  description: string;
  raw?: string;
};

type PromoBanner = {
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
};

function mergeNodeDataPreservePosition(prev: Node[], fresh: Node[]): Node[] {
  const pos = new Map(prev.map((n) => [n.id, n.position]));
  return fresh.map((n) => ({
    ...n,
    position: pos.get(n.id) ?? n.position,
  }));
}

const studioRefRows: { slot: RefImageSlot; label: string }[] = [
  { slot: "style", label: "图2 风格" },
  { slot: "ip", label: "图3 IP" },
  { slot: "coin", label: "图4 金币" },
];

type StudioPanelMode = "prompt" | "direction" | "kv" | "copy" | "banner";

function getStudioPanelMode(anchorId: string): StudioPanelMode {
  if (anchorId.startsWith("prompt-")) return "prompt";
  if (anchorId.startsWith("dir-")) return "direction";
  if (anchorId.startsWith("kv-")) return "kv";
  if (anchorId.startsWith("copy-")) return "copy";
  if (anchorId.startsWith("banner-")) return "banner";
  return "prompt";
}

function AutoFit({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.18, duration: 280, maxZoom: 1.15 });
    });
    return () => cancelAnimationFrame(id);
  }, [fitView, layoutKey]);
  return null;
}

const studioDotCanvasBg =
  "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[length:20px_20px]";

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="4" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 17h6M10 14v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StudioFlowHeader({ title }: { title: string }) {
  const { fitView } = useReactFlow();
  return (
    <Panel
      position="top-left"
      className="!m-0 !mt-0 !ml-0 w-full !max-w-none !translate-x-0 rounded-none border-b border-white/5 bg-black/30 px-4 py-3 backdrop-blur-md sm:px-6"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <div className="size-6 shrink-0 rounded-[8px] bg-white/10 sm:size-7" aria-hidden />
        </div>
        <h1 className="min-w-0 flex-1 truncate px-2 text-center text-sm font-semibold text-[#f0f0f0] sm:text-[14px]">
          {title}
        </h1>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#f0f0f0] hover:bg-white/5"
          onClick={() => fitView({ padding: 0.18, duration: 280, maxZoom: 1.15 })}
        >
          <MonitorIcon className="size-5 text-zinc-300" />
          <span className="hidden sm:inline">展开画布</span>
        </button>
      </div>
    </Panel>
  );
}

export function StudioCanvas() {
  return (
    <div className="min-h-screen bg-zinc-950 p-3 text-zinc-100 sm:p-4">
      <ReactFlowProvider>
        <StudioCanvasInner />
      </ReactFlowProvider>
    </div>
  );
}

function StudioCanvasInner() {
  const paneClickForDblRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const [threads, setThreads] = useState<Record<string, StudioThreadState>>({
    [STUDIO_MAIN_THREAD_ID]: emptyStudioThreadState(),
  });
  const [threadOrder, setThreadOrder] = useState<string[]>([STUDIO_MAIN_THREAD_ID]);
  const [preferredAnchorId, setPreferredAnchorId] = useState<string | null>(
    `prompt-${STUDIO_MAIN_THREAD_ID}`
  );

  const [promoDialogTarget, setPromoDialogTarget] = useState<{
    threadId: string;
    dirKey: DirKey;
  } | null>(null);

  const [kvCampaignType, setKvCampaignType] = useState<
    "scan" | "chongbang" | "star_collect" | "wheel" | "baiyuan"
  >("scan");
  const [chongbangSpecForm, setChongbangSpecForm] = useState({
    targetLanguage: "",
    scene: "",
    rewardItems: "",
    decorativeElements: "",
    primaryColor: "",
    mascotBrief: "",
    coinVariation: "",
    moodKeywords: "",
  });
  const [starCollectSpecForm, setStarCollectSpecForm] = useState({
    targetLanguage: "",
    collectible: "",
    container: "",
    scene: "",
    decorativeElements: "",
    primaryColor: "",
    ipBrief: "",
    coinVariation: "",
    moodKeywords: "",
  });
  const [wheelSpecForm, setWheelSpecForm] = useState({
    targetLanguage: "",
    scene: "",
    prizeElements: "",
    decorativeElements: "",
    primaryColor: "",
    ipBrief: "",
    coinVariation: "",
    moodKeywords: "",
  });
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [coinFile, setCoinFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelNotice, setPanelNotice] = useState<{
    kind: "error" | "info";
    text: string;
  } | null>(null);
  const [busyHint, setBusyHint] = useState("");
  const [kvPromoDialogOpen, setKvPromoDialogOpen] = useState(false);
  const [promoDialogInput, setPromoDialogInput] = useState("");
  const [studioRefining, setStudioRefining] = useState<StudioThreadRefining>(null);

  const patchThread = useCallback(
    (threadId: string, fn: (t: StudioThreadState) => StudioThreadState) => {
      setThreads((prev) => {
        const cur = prev[threadId];
        if (!cur) return prev;
        return { ...prev, [threadId]: fn(cur) };
      });
    },
    []
  );

  const activeThreadId = useMemo((): string => {
    if (preferredAnchorId) {
      const p = parseStudioAnchor(preferredAnchorId);
      if (p) return p.threadId;
    }
    return threadOrder[0] ?? STUDIO_MAIN_THREAD_ID;
  }, [preferredAnchorId, threadOrder]);

  const activeThread = threads[activeThreadId] ?? emptyStudioThreadState();

  const studioHeaderTitle = useMemo(() => {
    const t = (activeThread.committedTheme || activeThread.themeDraft || "").trim();
    return t || "画布工作室";
  }, [activeThread.committedTheme, activeThread.themeDraft]);

  const openKvPromoDialog = useCallback((threadId: string, key: DirKey) => {
    setPromoDialogTarget({ threadId, dirKey: key });
    patchThread(threadId, (t) => ({ ...t, selectedKvKey: key, selectedCopyKey: null }));
    setKvPromoDialogOpen(true);
    setPromoDialogInput("");
  }, [patchThread]);

  const onSelectCopy = useCallback(
    (threadId: string, key: DirKey) => {
      patchThread(threadId, (t) => ({ ...t, selectedCopyKey: key }));
    },
    [patchThread]
  );

  const onBannerSelect = useCallback(
    (threadId: string, key: DirKey) => {
      setPreferredAnchorId(`banner-${threadId}-${key}`);
      patchThread(threadId, (t) => ({ ...t, selectedCopyKey: key }));
    },
    [patchThread]
  );

  const toggleDirection = useCallback(
    (threadId: string, key: DirKey) => {
      patchThread(threadId, (t) => ({
        ...t,
        selected: t.selected.includes(key) ? t.selected.filter((x) => x !== key) : [...t.selected, key],
      }));
    },
    [patchThread]
  );

  const onDirectionCommit = useCallback(
    (threadId: string, key: DirKey, patch: { title?: string; content?: string }) => {
      patchThread(threadId, (t) => ({
        ...t,
        options: t.options.map((o) => (o.key === key ? { ...o, ...patch } : o)),
      }));
    },
    [patchThread]
  );

  const onPromoCopyCommit = useCallback(
    (threadId: string, key: DirKey, patch: Partial<PromoCopy>) => {
      patchThread(threadId, (t) => {
        const cur = t.promoCopyByKey[key];
        if (!cur) return t;
        return {
          ...t,
          promoCopyByKey: { ...t.promoCopyByKey, [key]: { ...cur, ...patch } },
        };
      });
    },
    [patchThread]
  );

  const setKvRefineDraft = useCallback(
    (threadId: string, key: DirKey, v: string) => {
      patchThread(threadId, (t) => ({
        ...t,
        kvRefineDraftByKey: { ...t.kvRefineDraftByKey, [key]: v },
      }));
    },
    [patchThread]
  );

  const setBannerRefineDraft = useCallback(
    (threadId: string, key: DirKey, v: string) => {
      patchThread(threadId, (t) => ({
        ...t,
        bannerRefineDraftByKey: { ...t.bannerRefineDraftByKey, [key]: v },
      }));
    },
    [patchThread]
  );

  const bumpKvHistory = useCallback((threadId: string, key: DirKey, delta: number) => {
    setThreads((prev) => {
      const t = prev[threadId];
      if (!t) return prev;
      let slot = t.kvSlots[key];
      let kvSlots = t.kvSlots;
      if (!slot?.history?.length) {
        const r = t.results.find((x) => x.optionKey === key);
        if (!r) return prev;
        slot = {
          history: [{ imageUrl: r.imageUrl, width: r.width, height: r.height, prompt: r.prompt }],
          index: 0,
        };
        kvSlots = { ...t.kvSlots, [key]: slot };
      }
      const ni = Math.max(0, Math.min(slot.history.length - 1, slot.index + delta));
      if (ni === slot.index && kvSlots === t.kvSlots) return prev;
      const snap = slot.history[ni];
      return {
        ...prev,
        [threadId]: {
          ...t,
          kvSlots: { ...kvSlots, [key]: { ...slot, index: ni } },
          results: t.results.map((r) => (r.optionKey === key ? { ...r, ...snap } : r)),
        },
      };
    });
  }, []);

  const bumpBannerHistory = useCallback((threadId: string, key: DirKey, delta: number) => {
    setThreads((prev) => {
      const t = prev[threadId];
      if (!t) return prev;
      let slot = t.promoBannerSlots[key];
      let slots = t.promoBannerSlots;
      if (!slot?.history?.length) {
        const b = t.promoBannerByKey[key];
        if (!b) return prev;
        slot = {
          history: [
            {
              imageUrl: b.imageUrl,
              width: b.width,
              height: b.height,
              prompt: b.prompt,
            },
          ],
          index: 0,
        };
        slots = { ...t.promoBannerSlots, [key]: slot };
      }
      const ni = Math.max(0, Math.min(slot.history.length - 1, slot.index + delta));
      if (ni === slot.index && slots === t.promoBannerSlots) return prev;
      const snap = slot.history[ni];
      const curBanner = t.promoBannerByKey[key];
      return {
        ...prev,
        [threadId]: {
          ...t,
          promoBannerSlots: { ...slots, [key]: { ...slot, index: ni } },
          promoBannerByKey: curBanner
            ? { ...t.promoBannerByKey, [key]: { ...curBanner, ...snap } }
            : t.promoBannerByKey,
        },
      };
    });
  }, []);

  const refineKv = useCallback(
    async (threadId: string, key: DirKey) => {
      const th = threads[threadId];
      if (!th) return;
      const instruction = (th.kvRefineDraftByKey[key] ?? "").trim();
      if (!instruction) {
        setPanelNotice({ kind: "info", text: "请先填写语言或修改说明" });
        return;
      }
      const slot = th.kvSlots[key];
      const fromResult = th.results.find((x) => x.optionKey === key);
      const snap =
        slot?.history[slot.index] ??
        (fromResult
          ? {
              imageUrl: fromResult.imageUrl,
              width: fromResult.width,
              height: fromResult.height,
              prompt: fromResult.prompt,
            }
          : null);
      if (!snap?.imageUrl) {
        setPanelNotice({ kind: "error", text: "没有可参照的成图" });
        return;
      }

      setStudioRefining({ kind: "kv", threadId, key });
      try {
        const res = await fetch("/api/regenerate-kv-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "kv",
            sourceImageUrl: snap.imageUrl,
            languageInstruction: instruction,
            width: snap.width,
            height: snap.height,
          }),
        });
        const data = await parseApiJson<{
          imageUrl: string;
          width: number;
          height: number;
          prompt: string;
          error?: string;
        }>(res);
        const entry: StudioVisualSnapshot = {
          imageUrl: data.imageUrl,
          width: data.width,
          height: data.height,
          prompt: data.prompt,
        };
        setThreads((prev) => {
          const t = prev[threadId];
          if (!t) return prev;
          const cur = t.kvSlots[key];
          const hist = [...(cur?.history ?? [{ ...snap }]), entry];
          const promoCopyByKey = { ...t.promoCopyByKey };
          delete promoCopyByKey[key];
          const promoBannerByKey = { ...t.promoBannerByKey };
          delete promoBannerByKey[key];
          const promoBannerSlots = { ...t.promoBannerSlots };
          delete promoBannerSlots[key];
          return {
            ...prev,
            [threadId]: {
              ...t,
              kvSlots: { ...t.kvSlots, [key]: { history: hist, index: hist.length - 1 } },
              results: t.results.map((r) => (r.optionKey === key ? { ...r, ...entry } : r)),
              promoCopyByKey,
              promoBannerByKey,
              promoBannerSlots,
              selectedCopyKey: t.selectedCopyKey === key ? null : t.selectedCopyKey,
            },
          };
        });
      } catch (e: unknown) {
        setPanelNotice({
          kind: "error",
          text: e instanceof Error ? e.message : "生成失败",
        });
      } finally {
        setStudioRefining(null);
      }
    },
    [threads]
  );

  const refineBanner = useCallback(
    async (threadId: string, key: DirKey) => {
      const th = threads[threadId];
      if (!th) return;
      const instruction = (th.bannerRefineDraftByKey[key] ?? "").trim();
      if (!instruction) {
        setPanelNotice({ kind: "info", text: "请先填写语言或修改说明" });
        return;
      }
      const slot = th.promoBannerSlots[key];
      const banner = th.promoBannerByKey[key];
      const snap =
        slot?.history[slot.index] ??
        (banner
          ? {
              imageUrl: banner.imageUrl,
              width: banner.width,
              height: banner.height,
              prompt: banner.prompt,
            }
          : null);
      if (!snap?.imageUrl) {
        setPanelNotice({ kind: "error", text: "没有可参照的推广图" });
        return;
      }

      setStudioRefining({ kind: "banner", threadId, key });
      try {
        const res = await fetch("/api/regenerate-kv-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "banner",
            sourceImageUrl: snap.imageUrl,
            languageInstruction: instruction,
            width: snap.width,
            height: snap.height,
          }),
        });
        const data = await parseApiJson<{
          imageUrl: string;
          width: number;
          height: number;
          prompt: string;
          error?: string;
        }>(res);
        const entry: StudioVisualSnapshot = {
          imageUrl: data.imageUrl,
          width: data.width,
          height: data.height,
          prompt: data.prompt,
        };
        setThreads((prev) => {
          const t = prev[threadId];
          if (!t) return prev;
          const cur = t.promoBannerSlots[key];
          const hist = [...(cur?.history ?? [{ ...snap }]), entry];
          const base =
            t.promoBannerByKey[key] ??
            ({
              prompt: entry.prompt,
              imageUrl: entry.imageUrl,
              width: entry.width,
              height: entry.height,
            } satisfies PromoBanner);
          return {
            ...prev,
            [threadId]: {
              ...t,
              promoBannerSlots: {
                ...t.promoBannerSlots,
                [key]: { history: hist, index: hist.length - 1 },
              },
              promoBannerByKey: { ...t.promoBannerByKey, [key]: { ...base, ...entry } },
            },
          };
        });
      } catch (e: unknown) {
        setPanelNotice({
          kind: "error",
          text: e instanceof Error ? e.message : "生成失败",
        });
      } finally {
        setStudioRefining(null);
      }
    },
    [threads]
  );

  const onRefImageChange = useCallback((slot: RefImageSlot, file: File | null) => {
    switch (slot) {
      case "style":
        setStyleFile(file);
        break;
      case "ip":
        setIpFile(file);
        break;
      case "coin":
        setCoinFile(file);
        break;
    }
  }, []);

  const buildChongbangSpecPayload = useCallback((): ChongbangKvSpec | undefined => {
    if (kvCampaignType !== "chongbang") return undefined;
    const out: ChongbangKvSpec = {};
    (Object.keys(chongbangSpecForm) as (keyof typeof chongbangSpecForm)[]).forEach((k) => {
      const v = chongbangSpecForm[k].trim();
      if (v) out[k] = v;
    });
    return Object.keys(out).length > 0 ? out : undefined;
  }, [kvCampaignType, chongbangSpecForm]);

  const buildStarCollectSpecPayload = useCallback((): StarCollectKvSpec | undefined => {
    if (kvCampaignType !== "star_collect") return undefined;
    const out: StarCollectKvSpec = {};
    (Object.keys(starCollectSpecForm) as (keyof typeof starCollectSpecForm)[]).forEach((k) => {
      const v = starCollectSpecForm[k].trim();
      if (v) out[k] = v;
    });
    return Object.keys(out).length > 0 ? out : undefined;
  }, [kvCampaignType, starCollectSpecForm]);

  const buildWheelSpecPayload = useCallback((): WheelKvSpec | undefined => {
    if (kvCampaignType !== "wheel") return undefined;
    const out: WheelKvSpec = {};
    (Object.keys(wheelSpecForm) as (keyof typeof wheelSpecForm)[]).forEach((k) => {
      const v = wheelSpecForm[k].trim();
      if (v) out[k] = v;
    });
    return Object.keys(out).length > 0 ? out : undefined;
  }, [kvCampaignType, wheelSpecForm]);

  const computed = useMemo(() => {
    const graphCallbacks = {
      toggleDirection,
      onKvOpenPromo: openKvPromoDialog,
      onSelectCopy,
      onBannerSelect,
      onDirectionCommit,
      onPromoCopyCommit,
      bumpKvHistory,
      bumpBannerHistory,
      setKvRefineDraft,
      setBannerRefineDraft,
      refineKv,
      refineBanner,
    };
    const preview = mergeStudioThreadGraphs(
      threadOrder,
      threads,
      null,
      studioRefining,
      graphCallbacks
    );
    const nodeIds = new Set(preview.nodes.map((n) => n.id));
    const fallbackPrompt =
      threadOrder.length > 0 ? `prompt-${threadOrder[0]!}` : `prompt-${STUDIO_MAIN_THREAD_ID}`;
    const graphFocus =
      preferredAnchorId && nodeIds.has(preferredAnchorId)
        ? preferredAnchorId
        : nodeIds.has(fallbackPrompt)
          ? fallbackPrompt
          : [...nodeIds].find((id) => id.startsWith("prompt-")) ?? null;

    const raw = mergeStudioThreadGraphs(
      threadOrder,
      threads,
      graphFocus,
      studioRefining,
      graphCallbacks
    );
    const laidOut = layoutStudioNodes(raw.nodes, raw.edges);
    const suppressedSig = threadOrder
      .map((tid) => [...(threads[tid]?.suppressedDirKeys ?? [])].sort().join(""))
      .join("|");
    const sig = `${threadOrder.join(",")}__${[...laidOut.map((n) => n.id)].sort().join("|")}__${[...raw.edges.map((e) => e.id)].sort().join("|")}__${suppressedSig}`;
    return { nodes: laidOut, edges: raw.edges, sig };
  }, [
    threadOrder,
    threads,
    preferredAnchorId,
    studioRefining,
    toggleDirection,
    openKvPromoDialog,
    onSelectCopy,
    onBannerSelect,
    onDirectionCommit,
    onPromoCopyCommit,
    bumpKvHistory,
    bumpBannerHistory,
    setKvRefineDraft,
    setBannerRefineDraft,
    refineKv,
    refineBanner,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const structureSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (computed.nodes.length === 0) {
      structureSigRef.current = null;
      setNodes([]);
      setEdges([]);
      return;
    }
    if (computed.sig !== structureSigRef.current) {
      structureSigRef.current = computed.sig;
      setNodes(computed.nodes);
      setEdges(computed.edges);
    } else {
      setNodes((prev) => mergeNodeDataPreservePosition(prev, computed.nodes));
      setEdges(computed.edges);
    }
  }, [computed, setNodes, setEdges]);

  const effectiveAnchorId = useMemo(() => {
    if (nodes.length === 0) return null;
    if (preferredAnchorId && nodes.some((n) => n.id === preferredAnchorId)) {
      return preferredAnchorId;
    }
    const firstPrompt =
      threadOrder.length > 0 ? `prompt-${threadOrder[0]!}` : `prompt-${STUDIO_MAIN_THREAD_ID}`;
    return nodes.find((n) => n.id === firstPrompt)?.id ?? nodes[0]!.id;
  }, [nodes, preferredAnchorId, threadOrder]);

  const deleteFocusedBranch = useCallback(() => {
    const id = effectiveAnchorId;
    if (!id) return;
    const p = parseStudioAnchor(id);
    if (!p || p.kind === "prompt") return;

    if (p.kind === "banner") {
      patchThread(p.threadId, (t) => {
        const promoBannerByKey = { ...t.promoBannerByKey };
        delete promoBannerByKey[p.dirKey];
        const promoBannerSlots = { ...t.promoBannerSlots };
        delete promoBannerSlots[p.dirKey];
        const bannerRefineDraftByKey = { ...t.bannerRefineDraftByKey };
        delete bannerRefineDraftByKey[p.dirKey];
        return { ...t, promoBannerByKey, promoBannerSlots, bannerRefineDraftByKey };
      });
      setPreferredAnchorId(`copy-${p.threadId}-${p.dirKey}`);
      return;
    }
    if (p.kind === "copy") {
      patchThread(p.threadId, (t) => {
        const promoCopyByKey = { ...t.promoCopyByKey };
        delete promoCopyByKey[p.dirKey];
        const promoBannerByKey = { ...t.promoBannerByKey };
        delete promoBannerByKey[p.dirKey];
        const promoBannerSlots = { ...t.promoBannerSlots };
        delete promoBannerSlots[p.dirKey];
        const bannerRefineDraftByKey = { ...t.bannerRefineDraftByKey };
        delete bannerRefineDraftByKey[p.dirKey];
        return {
          ...t,
          promoCopyByKey,
          promoBannerByKey,
          promoBannerSlots,
          bannerRefineDraftByKey,
          selectedCopyKey: t.selectedCopyKey === p.dirKey ? null : t.selectedCopyKey,
        };
      });
      setPreferredAnchorId(`kv-${p.threadId}-${p.dirKey}`);
      return;
    }
    if (p.kind === "kv") {
      const k = p.dirKey;
      patchThread(p.threadId, (t) => {
        const kvSlots = { ...t.kvSlots };
        delete kvSlots[k];
        const kvRefineDraftByKey = { ...t.kvRefineDraftByKey };
        delete kvRefineDraftByKey[k];
        const promoCopyByKey = { ...t.promoCopyByKey };
        delete promoCopyByKey[k];
        const promoBannerByKey = { ...t.promoBannerByKey };
        delete promoBannerByKey[k];
        const promoBannerSlots = { ...t.promoBannerSlots };
        delete promoBannerSlots[k];
        const bannerRefineDraftByKey = { ...t.bannerRefineDraftByKey };
        delete bannerRefineDraftByKey[k];
        return {
          ...t,
          results: t.results.filter((x) => x.optionKey !== k),
          kvSlots,
          kvRefineDraftByKey,
          promoCopyByKey,
          promoBannerByKey,
          promoBannerSlots,
          bannerRefineDraftByKey,
          selectedKvKey: t.selectedKvKey === k ? null : t.selectedKvKey,
          selectedCopyKey: t.selectedCopyKey === k ? null : t.selectedCopyKey,
        };
      });
      setPreferredAnchorId(`dir-${p.threadId}-${p.dirKey}`);
      return;
    }
    if (p.kind === "direction") {
      const k = p.dirKey;
      patchThread(p.threadId, (t) => {
        const kvSlots = { ...t.kvSlots };
        delete kvSlots[k];
        const kvRefineDraftByKey = { ...t.kvRefineDraftByKey };
        delete kvRefineDraftByKey[k];
        const promoCopyByKey = { ...t.promoCopyByKey };
        delete promoCopyByKey[k];
        const promoBannerByKey = { ...t.promoBannerByKey };
        delete promoBannerByKey[k];
        const promoBannerSlots = { ...t.promoBannerSlots };
        delete promoBannerSlots[k];
        const bannerRefineDraftByKey = { ...t.bannerRefineDraftByKey };
        delete bannerRefineDraftByKey[k];
        return {
          ...t,
          suppressedDirKeys: [...new Set([...t.suppressedDirKeys, k])],
          selected: t.selected.filter((x) => x !== k),
          results: t.results.filter((x) => x.optionKey !== k),
          kvSlots,
          kvRefineDraftByKey,
          promoCopyByKey,
          promoBannerByKey,
          promoBannerSlots,
          bannerRefineDraftByKey,
          selectedKvKey: t.selectedKvKey === k ? null : t.selectedKvKey,
          selectedCopyKey: t.selectedCopyKey === k ? null : t.selectedCopyKey,
        };
      });
      setPreferredAnchorId(`prompt-${p.threadId}`);
      return;
    }
  }, [effectiveAnchorId, patchThread]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (kvPromoDialogOpen) return;
      const anchor = effectiveAnchorId ? parseStudioAnchor(effectiveAnchorId) : null;
      if (!anchor || anchor.kind === "prompt") return;
      e.preventDefault();
      deleteFocusedBranch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effectiveAnchorId, kvPromoDialogOpen, deleteFocusedBranch]);

  useEffect(() => {
    if (!kvPromoDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKvPromoDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kvPromoDialogOpen]);

  async function handleGenerateDirections(threadId: string) {
    const th = threads[threadId];
    if (!th) return;
    const t = th.themeDraft.trim();
    if (!t) {
      setPanelNotice({ kind: "info", text: "请输入主题" });
      return;
    }

    setPanelNotice(null);
    setBusyHint("生成方向中…");
    setLoading(true);
    patchThread(threadId, (cur) => ({
      ...cur,
      committedTheme: t,
      promptStatus: "loading",
      promptError: undefined,
    }));

    try {
      const res = await fetch("/api/theme-directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: t, campaignType: kvCampaignType }),
      });
      const data = await parseApiJson<{ options: DirectionOption[]; error?: string }>(res);
      patchThread(threadId, (cur) => ({
        ...cur,
        options: data.options,
        suppressedDirKeys: [],
        promptStatus: "done",
      }));
    } catch (e: unknown) {
      patchThread(threadId, (cur) => ({
        ...cur,
        promptStatus: "error",
        promptError: e instanceof Error ? e.message : "请求失败",
      }));
    } finally {
      setLoading(false);
      setBusyHint("");
    }
  }

  async function buildKvBody(threadId: string) {
    const th = threads[threadId];
    if (!th) throw new Error("missing thread");
    const theme = th.themeDraft.trim() || th.committedTheme || "";
    const chongSpec = kvCampaignType === "chongbang" ? buildChongbangSpecPayload() : undefined;
    const starSpec = kvCampaignType === "star_collect" ? buildStarCollectSpecPayload() : undefined;
    const wheelSpec = kvCampaignType === "wheel" ? buildWheelSpecPayload() : undefined;
    return {
      theme,
      selectedOptions: th.selected,
      optionContents: th.options,
      campaignType: kvCampaignType,
      ...(chongSpec ? { chongbangSpec: chongSpec } : {}),
      ...(starSpec ? { starCollectSpec: starSpec } : {}),
      ...(wheelSpec ? { wheelSpec } : {}),
      images: {
        styleBase64: styleFile ? await compressRefFile(styleFile) : undefined,
        ipBase64: ipFile ? await compressIpRefFile(ipFile) : undefined,
        coinBase64: coinFile ? await compressRefFile(coinFile) : undefined,
      },
    };
  }

  async function handleGenerateKv(threadId: string) {
    const th = threads[threadId];
    if (!th) return;
    if (th.selected.length === 0) {
      setPanelNotice({ kind: "info", text: "请至少选择一个方向" });
      return;
    }

    setPanelNotice(null);
    setBusyHint("生成主视觉中…");
    setLoading(true);
    try {
      const body = await buildKvBody(threadId);
      const res = await fetch("/api/generate-kv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseApiJson<{
        results: GeneratedImageResult[];
        error?: string;
      }>(res);
      const touchedKeys = new Set(data.results.map((r) => r.optionKey));
      setThreads((prev) => {
        const t = prev[threadId];
        if (!t) return prev;
        const map = new Map(t.results.map((r) => [r.optionKey, r]));
        for (const r of data.results) {
          map.set(r.optionKey, r);
        }
        const newResults = Array.from(map.values());
        const promoCopyByKey = { ...t.promoCopyByKey };
        const promoBannerByKey = { ...t.promoBannerByKey };
        const promoBannerSlots = { ...t.promoBannerSlots };
        const bannerRefineDraftByKey = { ...t.bannerRefineDraftByKey };
        for (const k of touchedKeys) {
          delete promoCopyByKey[k];
          delete promoBannerByKey[k];
          delete promoBannerSlots[k];
          delete bannerRefineDraftByKey[k];
        }
        const kvSlots = { ...t.kvSlots };
        for (const r of data.results) {
          const entry: StudioVisualSnapshot = {
            imageUrl: r.imageUrl,
            width: r.width,
            height: r.height,
            prompt: r.prompt,
          };
          const cur = kvSlots[r.optionKey];
          if (!cur) {
            kvSlots[r.optionKey] = { history: [entry], index: 0 };
          } else {
            const hist = [...cur.history, entry];
            kvSlots[r.optionKey] = { history: hist, index: hist.length - 1 };
          }
        }
        return {
          ...prev,
          [threadId]: {
            ...t,
            results: newResults,
            promoCopyByKey,
            promoBannerByKey,
            promoBannerSlots,
            bannerRefineDraftByKey,
            kvSlots,
          },
        };
      });
    } catch (e: unknown) {
      setPanelNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "主视觉生成失败",
      });
    } finally {
      setLoading(false);
      setBusyHint("");
    }
  }

  /**
   * 共用「生成」：
   * 1) 已选中文案节点 → 出推广图
   * 2) 已出四方向 + 已选方向 → 出主视觉（内置版式 + 可选图2–4）
   * 3) 否则 → 按主题生成/刷新 A/B/C/D（需填写主题）
   */
  async function handlePrimaryGenerate() {
    const tid = activeThreadId;
    const th = threads[tid] ?? emptyStudioThreadState();
    if (th.selectedCopyKey && th.promoCopyByKey[th.selectedCopyKey]) {
      await submitBannerFromFooter(tid);
      return;
    }

    const t = th.themeDraft.trim();
    if (!t) {
      setPanelNotice({ kind: "info", text: "请输入主题" });
      return;
    }

    if (th.options.length > 0 && th.selected.length > 0) {
      await handleGenerateKv(tid);
      return;
    }

    await handleGenerateDirections(tid);
  }

  async function submitKvPromoDialog() {
    const target = promoDialogTarget;
    if (!target) {
      setPanelNotice({ kind: "info", text: "请先在画布上点选一张主视觉图" });
      return;
    }
    const { threadId, dirKey: key } = target;
    const th = threads[threadId];
    if (!th) {
      setPanelNotice({ kind: "error", text: "数据异常，请重新生成主视觉" });
      return;
    }
    const visual = th.results.find((r) => r.optionKey === key);
    const opt = th.options.find((o) => o.key === key);
    if (!visual || !opt) {
      setPanelNotice({ kind: "error", text: "数据异常，请重新生成主视觉" });
      return;
    }

    setPanelNotice(null);
    setBusyHint("生成推广文案中…");
    setLoading(true);
    try {
      const copyRes = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: th.themeDraft.trim() || th.committedTheme || "",
          selectedOptionKey: opt.key,
          selectedOptionContent: opt.content,
        }),
      });
      const copyData = await parseApiJson<PromoCopy & { error?: string }>(copyRes);
      patchThread(threadId, (t) => {
        const promoBannerByKey = { ...t.promoBannerByKey };
        delete promoBannerByKey[key];
        return {
          ...t,
          promoCopyByKey: { ...t.promoCopyByKey, [key]: copyData },
          promoBannerByKey,
          selectedCopyKey: key,
        };
      });
      setKvPromoDialogOpen(false);
    } catch (e: unknown) {
      setPanelNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "推广文案生成失败",
      });
    } finally {
      setLoading(false);
      setBusyHint("");
    }
  }

  async function submitBannerFromFooter(threadId: string) {
    const th = threads[threadId];
    if (!th) return;
    const key = th.selectedCopyKey;
    if (!key) {
      setPanelNotice({ kind: "info", text: "请先在画布上点选「推广文案」节点" });
      return;
    }
    const copy = th.promoCopyByKey[key];
    if (!copy) {
      setPanelNotice({
        kind: "info",
        text: "该方案暂无文案节点，请先从主视觉生成文案",
      });
      return;
    }
    const visual = th.results.find((r) => r.optionKey === key);
    const opt = th.options.find((o) => o.key === key);
    if (!visual || !opt) {
      setPanelNotice({ kind: "error", text: "数据异常，请重新生成主视觉" });
      return;
    }

    setPanelNotice(null);
    setBusyHint("生成推广图中…");
    setLoading(true);
    try {
      const bannerRes = await fetch("/api/generate-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: th.themeDraft.trim() || th.committedTheme || "",
          selectedOptionKey: opt.key,
          selectedOptionContent: opt.content,
          mainVisualUrl: visual.imageUrl,
          headline: copy.headline,
          subheadline: copy.subheadline,
          description: copy.description,
        }),
      });
      const bannerData = await parseApiJson<PromoBanner & { error?: string }>(bannerRes);
      patchThread(threadId, (t) => {
        const cur = t.promoBannerSlots[key];
        const entry: StudioVisualSnapshot = {
          imageUrl: bannerData.imageUrl,
          width: bannerData.width,
          height: bannerData.height,
          prompt: bannerData.prompt,
        };
        const hist = [...(cur?.history ?? []), entry];
        return {
          ...t,
          promoBannerByKey: { ...t.promoBannerByKey, [key]: bannerData },
          promoBannerSlots: {
            ...t.promoBannerSlots,
            [key]: { history: hist, index: hist.length - 1 },
          },
        };
      });
    } catch (e: unknown) {
      setPanelNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "推广图生成失败",
      });
    } finally {
      setLoading(false);
      setBusyHint("");
    }
  }

  const panelMode: StudioPanelMode = effectiveAnchorId
    ? getStudioPanelMode(effectiveAnchorId)
    : "prompt";
  const anchorKey = effectiveAnchorId ? dirKeyFromStudioNodeId(effectiveAnchorId) : null;

  /** 主题节点：只改主题；方案/主视觉节点：显示参考图上传（方案节点优先突出上传区） */
  const showFileUploadsPanel =
    activeThread.options.length > 0 &&
    panelMode !== "prompt" &&
    panelMode !== "copy" &&
    panelMode !== "banner";

  const themeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadsSectionRef = useRef<HTMLDivElement>(null);
  const [uploadSectionHighlight, setUploadSectionHighlight] = useState(false);

  useEffect(() => {
    if (kvPromoDialogOpen) return;
    const id = requestAnimationFrame(() => {
      if (effectiveAnchorId?.startsWith("prompt-")) {
        themeTextareaRef.current?.focus();
        return;
      }
      if (effectiveAnchorId?.startsWith("dir-")) {
        uploadsSectionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [effectiveAnchorId, kvPromoDialogOpen]);

  useEffect(() => {
    if (!effectiveAnchorId?.startsWith("dir-") || kvPromoDialogOpen) return;
    const show = window.setTimeout(() => setUploadSectionHighlight(true), 0);
    const hide = window.setTimeout(() => setUploadSectionHighlight(false), 2200);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [effectiveAnchorId, kvPromoDialogOpen]);

  const studioPanelRef = useRef<HTMLDivElement>(null);
  const [studioPanelDocked, setStudioPanelDocked] = useState(true);
  const [studioPanelPos, setStudioPanelPos] = useState({ x: 0, y: 0 });
  const studioPanelDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const beginStudioPanelDrag = useCallback((e: ReactPointerEvent<Element>) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = studioPanelRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    setStudioPanelDocked(false);
    setStudioPanelPos({ x: r.left, y: r.top });
    studioPanelDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeft: r.left,
      startTop: r.top,
    };
    panel.setPointerCapture(e.pointerId);
  }, []);

  const onStudioPanelPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = studioPanelDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setStudioPanelPos({
      x: d.startLeft + (e.clientX - d.startClientX),
      y: d.startTop + (e.clientY - d.startClientY),
    });
  }, []);

  const onStudioPanelPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = studioPanelDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    studioPanelDragRef.current = null;
    const panel = studioPanelRef.current;
    if (panel?.hasPointerCapture(e.pointerId)) {
      panel.releasePointerCapture(e.pointerId);
    }
  }, []);

  const anchorPanelToNode =
    studioPanelDocked &&
    !!effectiveAnchorId &&
    (panelMode === "direction" || panelMode === "kv");

  const [panelAnchorPayload, setPanelAnchorPayload] = useState<StudioPanelAnchorPayload | null>(
    null
  );
  const onPanelAnchorPayload = useCallback((p: StudioPanelAnchorPayload | null) => {
    setPanelAnchorPayload(p);
  }, []);

  const [nearNodeLayout, setNearNodeLayout] = useState<{
    left: number;
    top: number;
    placedRight: boolean;
  } | null>(null);

  const [panelLinkPath, setPanelLinkPath] = useState<string | null>(null);
  const [panelLayoutTick, setPanelLayoutTick] = useState(0);
  const [linkPulse, setLinkPulse] = useState(false);

  useEffect(() => {
    const onResize = () => setPanelLayoutTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (!anchorPanelToNode || !panelAnchorPayload) {
      setNearNodeLayout(null);
      return;
    }
    const GAP = 16;
    const MARGIN = 10;
    const pw = Math.min(window.innerWidth * 0.92, 28 * 16);
    const { anchorOnNode, nodeBounds } = panelAnchorPayload;
    let left = anchorOnNode.x + GAP;
    let placedRight = true;
    if (left + pw > window.innerWidth - MARGIN) {
      left = nodeBounds.left - GAP - pw;
      placedRight = false;
    }
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - pw - MARGIN);
    const phEst = Math.min(window.innerHeight * 0.42, 560);
    const half = phEst / 2;
    const top = Math.min(
      Math.max(MARGIN + half, anchorOnNode.y),
      window.innerHeight - MARGIN - half
    );
    setNearNodeLayout({ left, top, placedRight });
  }, [anchorPanelToNode, panelAnchorPayload, panelLayoutTick]);

  useLayoutEffect(() => {
    const el = studioPanelRef.current;
    if (!el || !anchorPanelToNode) return;
    const ro = new ResizeObserver(() => setPanelLayoutTick((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [anchorPanelToNode, effectiveAnchorId]);

  useLayoutEffect(() => {
    if (
      !studioPanelDocked ||
      !anchorPanelToNode ||
      !nearNodeLayout ||
      !panelAnchorPayload ||
      !studioPanelRef.current
    ) {
      setPanelLinkPath(null);
      return;
    }
    const pr = studioPanelRef.current.getBoundingClientRect();
    const { anchorOnNode } = panelAnchorPayload;
    const x1 = anchorOnNode.x;
    const y1 = anchorOnNode.y;
    const x2 = nearNodeLayout.placedRight ? pr.left : pr.right;
    const y2 = pr.top + pr.height / 2;
    const dx = x2 - x1;
    const cx1 = x1 + dx * 0.42;
    const cy1 = y1;
    const cx2 = x1 + dx * 0.58;
    const cy2 = y2;
    setPanelLinkPath(`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
  }, [
    studioPanelDocked,
    anchorPanelToNode,
    nearNodeLayout,
    panelAnchorPayload,
    panelLayoutTick,
  ]);

  /** 只用「是否有连线」，不要用 path 字符串：否则路径因布局/ResizeObserver 微变会反复触发本 effect，与 setLinkPulse 形成死循环 */
  const panelLinkActive = panelLinkPath != null;

  useEffect(() => {
    if (!panelLinkActive) return;
    setLinkPulse(true);
    const t = window.setTimeout(() => setLinkPulse(false), 2200);
    return () => clearTimeout(t);
  }, [effectiveAnchorId, panelLinkActive]);

  const panelDockedBottomCenter =
    studioPanelDocked &&
    (!anchorPanelToNode || !nearNodeLayout || !panelAnchorPayload);

  const panelPositionStyle:
    | { left: number; top: number; transform?: string }
    | undefined = !studioPanelDocked
    ? { left: studioPanelPos.x, top: studioPanelPos.y }
    : anchorPanelToNode && nearNodeLayout
      ? { left: nearNodeLayout.left, top: nearNodeLayout.top, transform: "translateY(-50%)" }
      : undefined;

  const appendNewStudioThread = useCallback(() => {
    const id = makeStudioThreadId();
    setThreads((prev) => ({ ...prev, [id]: emptyStudioThreadState() }));
    setThreadOrder((prev) => [...prev, id]);
    setPreferredAnchorId(`prompt-${id}`);
  }, []);

  /** 根节点 onDoubleClick 在点到 pane 时常常收不到；用 onPaneClick 做双击判定 */
  const onPaneClick = useCallback(
    (e: ReactMouseEvent) => {
      const now = e.timeStamp;
      const prev = paneClickForDblRef.current;
      const { clientX: x, clientY: y } = e;
      if (
        prev &&
        now - prev.time < 450 &&
        Math.hypot(x - prev.x, y - prev.y) < 14
      ) {
        paneClickForDblRef.current = null;
        e.preventDefault();
        appendNewStudioThread();
        return;
      }
      paneClickForDblRef.current = { time: now, x, y };
    },
    [appendNewStudioThread]
  );

  const chongbangParamFields =
    kvCampaignType === "chongbang" ? (
      <details className="mt-2 rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-zinc-300 hover:text-zinc-200">
          冲榜主题参数（可选，写入生图 PE）
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["targetLanguage", "目标语言"],
              ["scene", "场景"],
              ["rewardItems", "奖励物"],
              ["decorativeElements", "装饰元素"],
              ["primaryColor", "主色调"],
              ["mascotBrief", "吉祥物设定"],
              ["coinVariation", "金币变化方向"],
              ["moodKeywords", "气质关键词"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-zinc-400">
              {label}
              <input
                type="text"
                value={chongbangSpecForm[key]}
                onChange={(e) =>
                  setChongbangSpecForm((p) => ({ ...p, [key]: e.target.value }))
                }
                className="mt-0.5 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-zinc-100"
              />
            </label>
          ))}
        </div>
      </details>
    ) : null;

  const starCollectParamFields =
    kvCampaignType === "star_collect" ? (
      <details className="mt-2 rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-zinc-300 hover:text-zinc-200">
          星星收集参数（可选，写入生图 PE）
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["targetLanguage", "目标语言"],
              ["collectible", "收集物"],
              ["container", "容器"],
              ["scene", "场景"],
              ["decorativeElements", "装饰元素"],
              ["primaryColor", "主色调"],
              ["ipBrief", "IP设定"],
              ["coinVariation", "金币变化方向"],
              ["moodKeywords", "关键词"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-zinc-400">
              {label}
              <input
                type="text"
                value={starCollectSpecForm[key]}
                onChange={(e) =>
                  setStarCollectSpecForm((p) => ({ ...p, [key]: e.target.value }))
                }
                className="mt-0.5 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-zinc-100"
              />
            </label>
          ))}
        </div>
      </details>
    ) : null;

  const wheelParamFields =
    kvCampaignType === "wheel" ? (
      <details className="mt-2 rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-zinc-300 hover:text-zinc-200">
          转盘抽奖参数（可选，写入生图 PE）
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["targetLanguage", "目标语言"],
              ["scene", "场景"],
              ["prizeElements", "奖品元素"],
              ["decorativeElements", "装饰元素"],
              ["primaryColor", "主色调"],
              ["ipBrief", "IP设定"],
              ["coinVariation", "金币变化方向"],
              ["moodKeywords", "关键词"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-zinc-400">
              {label}
              <input
                type="text"
                value={wheelSpecForm[key]}
                onChange={(e) =>
                  setWheelSpecForm((p) => ({ ...p, [key]: e.target.value }))
                }
                className="mt-0.5 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-zinc-100"
              />
            </label>
          ))}
        </div>
      </details>
    ) : null;

  const kvCampaignRadios = (
    <div className="space-y-2 border-b border-white/10 pb-3">
      <p className="text-[11px] font-medium tracking-wide text-white/45">玩法</p>
      <div
        className="flex flex-wrap gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]"
        role="radiogroup"
        aria-label="KV 玩法类型"
      >
        {(
          [
            ["scan", "扫码"],
            ["chongbang", "冲榜"],
            ["star_collect", "星星收集"],
            ["wheel", "转盘"],
            ["baiyuan", "百元"],
          ] as const
        ).map(([value, label]) => {
          const selected = kvCampaignType === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                selected
                  ? "bg-[#EB0EF5] text-white shadow-sm"
                  : "text-white/55 hover:bg-white/10 hover:text-white/85"
              }`}
              onClick={() => setKvCampaignType(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div
        className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[rgba(28,31,35,0.12)] shadow-2xl sm:h-[calc(100vh-2rem)]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgb(28,28,28) 46%), linear-gradient(90deg, rgb(53,53,53) 0%, rgb(53,53,53) 100%)",
        }}
      >
        <div className={`relative min-h-0 flex-1 ${studioDotCanvasBg}`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              paneClickForDblRef.current = null;
              setPreferredAnchorId(node.id);
              const p = parseStudioAnchor(node.id);
              if (!p || p.kind === "prompt") return;
              if (p.kind === "kv") {
                patchThread(p.threadId, (t) => ({
                  ...t,
                  selectedKvKey: p.dirKey,
                  selectedCopyKey: null,
                }));
                return;
              }
              if (p.kind === "copy" || p.kind === "banner") {
                patchThread(p.threadId, (t) => ({ ...t, selectedCopyKey: p.dirKey }));
                return;
              }
              patchThread(p.threadId, (t) => ({ ...t, selectedCopyKey: null }));
            }}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            nodesDraggable
            nodeDragThreshold={10}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
            className="h-full !bg-transparent"
          >
            <StudioFlowHeader title={studioHeaderTitle} />
            <Controls className="!border-white/10 !bg-black/45 backdrop-blur-sm [&_button]:!border-white/10 [&_button]:!bg-black/50 [&_svg]:!fill-zinc-200" />
            <MiniMap
              className="!border-white/10 !bg-black/45 backdrop-blur-sm"
              nodeStrokeWidth={2}
              maskColor="rgba(24,24,27,0.82)"
            />
            <AutoFit layoutKey={computed.sig} />
            <StudioPanelAnchorBridge
              nodeId={anchorPanelToNode && effectiveAnchorId ? effectiveAnchorId : null}
              enabled={anchorPanelToNode}
              onPayload={onPanelAnchorPayload}
            />
            <Panel position="top-right" className="m-2 mt-14 flex flex-col gap-2 sm:mt-16">
              <Link
                href="/"
                className="inline-block rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur hover:bg-white/10"
              >
                返回标准流程
              </Link>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {panelLinkPath ? (
        <svg
          className={`pointer-events-none fixed inset-0 z-[10039] transition-opacity duration-700 ${
            linkPulse ? "opacity-100" : "opacity-[0.32]"
          }`}
          aria-hidden
        >
          <path
            d={panelLinkPath}
            fill="none"
            stroke={`rgba(${STUDIO_ACCENT_RGB},0.65)`}
            strokeWidth={1.5}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      {effectiveAnchorId ? (
        <div
          ref={studioPanelRef}
          className={`fixed z-[10040] max-h-[42vh] w-[min(92vw,26rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-[#26292b]/98 py-3 pl-3 pr-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] backdrop-blur-md sm:w-[28rem] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 ${
            panelDockedBottomCenter ? "bottom-6 left-1/2 -translate-x-1/2" : ""
          }`}
          style={panelPositionStyle}
          onPointerMove={onStudioPanelPointerMove}
          onPointerUp={onStudioPanelPointerUp}
          onPointerCancel={onStudioPanelPointerUp}
        >
          <div
            className="pointer-events-auto absolute bottom-0 left-0 top-0 z-10 w-3.5 touch-none rounded-l-2xl border-r border-white/[0.08] bg-gradient-to-r from-black/35 to-transparent hover:from-black/45 active:from-[#EB0EF5]/15"
            aria-hidden
          />
          <button
            type="button"
            className="pointer-events-auto absolute bottom-0 left-0 top-0 z-[11] w-3.5 cursor-grab touch-none rounded-l-2xl border-0 bg-transparent active:cursor-grabbing"
            aria-label="拖动面板"
            title="拖动"
            onPointerDown={beginStudioPanelDrag}
          />
          <div className="relative min-w-0 pl-2.5">
            <div
            className="mb-3 flex min-h-11 cursor-grab select-none items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 active:cursor-grabbing"
            onPointerDown={beginStudioPanelDrag}
            onDoubleClick={(e) => {
              e.preventDefault();
              setStudioPanelDocked(true);
            }}
            title="拖动"
            aria-label="拖动面板"
          >
            <span className="font-mono text-sm leading-none text-white/40" aria-hidden>
              ⋮⋮
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-medium text-white/85">
                {panelMode === "prompt" && "当前：主题 / 四方向"}
                {panelMode === "direction" && `当前：方向 · ${anchorKey ?? "—"}`}
                {panelMode === "kv" && `当前：主视觉 · ${anchorKey ?? "—"}`}
                {panelMode === "copy" && `当前：推广文案 · ${anchorKey ?? "—"}`}
                {panelMode === "banner" && `当前：推广图 · ${anchorKey ?? "—"}`}
              </p>
            </div>
          </div>
          {panelNotice ? (
            <div className="mb-2">
              <FlowNotice
                kind={panelNotice.kind}
                message={panelNotice.text}
                onDismiss={() => setPanelNotice(null)}
              />
            </div>
          ) : null}
          {loading && busyHint ? (
            <p className="mb-2 text-xs text-[#f576f7]">{busyHint}</p>
          ) : null}
          {panelMode === "direction" && showFileUploadsPanel ? (
            <div
              ref={uploadsSectionRef}
              className={`space-y-2 rounded-xl transition-shadow duration-300 ${
                uploadSectionHighlight
                  ? "ring-2 ring-[#EB0EF5]/70 ring-offset-2 ring-offset-[#26292b]"
                  : ""
              }`}
            >
              {kvCampaignRadios}
              {chongbangParamFields}
              {starCollectParamFields}
              {wheelParamFields}
              <ul className="grid gap-2 sm:grid-cols-1 sm:grid-cols-2">
                {studioRefRows.map(({ slot, label }) => {
                  const chosen = slot === "style" ? styleFile : slot === "ip" ? ipFile : coinFile;
                  return (
                    <li key={slot}>
                      <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 ring-1 ring-white/[0.04] transition-colors hover:border-white/15">
                        <span className="text-[11px] font-medium text-white/50">{label}</span>
                        <div className="flex min-h-[2rem] items-center gap-2">
                          <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/85">
                            选择文件
                          </span>
                          <span
                            className="min-w-0 truncate text-[10px] text-white/40"
                            title={chosen?.name}
                          >
                            {chosen ? chosen.name : "未选择"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => onRefImageChange(slot, e.target.files?.[0] ?? null)}
                          />
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p
                className={`rounded-xl border px-3 py-2 text-xs ${
                  activeThread.selected.length > 0
                    ? "border-[#EB0EF5]/50 bg-[#EB0EF5]/10 text-[#f0a8fc]"
                    : "border-white/10 bg-black/25 text-white/45"
                }`}
              >
                <span className="font-medium text-white/70">已选方向：</span>
                {activeThread.selected.length > 0
                  ? [...activeThread.selected].sort().join("、")
                  : "—"}
                {activeThread.selected.length > 0 ? `（${activeThread.selected.length}）` : null}
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => void handlePrimaryGenerate()}
                  disabled={loading}
                  aria-label="生成"
                  title="生成"
                  className={`inline-flex items-center justify-center rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-white hover:bg-[#c90ad0] disabled:opacity-50 ${
                    activeThread.selectedCopyKey &&
                    activeThread.promoCopyByKey[activeThread.selectedCopyKey]
                      ? "ring-2 ring-[#EB0EF5]/65 ring-offset-2 ring-offset-[#26292b]"
                      : ""
                  }`}
                >
                  <FourPointStarIcon className="size-5 drop-shadow-sm" />
                </button>
              </div>
            </div>
          ) : null}

          {panelMode === "direction" ? (
            <details className="mt-3 border-t border-white/10 pt-3">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
                主题
              </summary>
              <label className="mt-2 block text-xs text-zinc-400">
                <span className="sr-only">主题</span>
                <textarea
                  value={activeThread.themeDraft}
                  onChange={(e) =>
                    patchThread(activeThreadId, (t) => ({ ...t, themeDraft: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (!loading) void handlePrimaryGenerate();
                    }
                  }}
                  rows={2}
                  placeholder="活动 / 产品简述"
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </label>
            </details>
          ) : null}

          {panelMode !== "banner" && panelMode !== "direction" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs text-zinc-400">
                主题
                <textarea
                  ref={themeTextareaRef}
                  value={activeThread.themeDraft}
                  onChange={(e) =>
                    patchThread(activeThreadId, (t) => ({ ...t, themeDraft: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (!loading) void handlePrimaryGenerate();
                    }
                  }}
                  rows={2}
                  placeholder="活动 / 产品简述"
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </label>
              <button
                type="button"
                onClick={() => void handlePrimaryGenerate()}
                disabled={loading}
                aria-label="生成"
                title="生成"
                className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-white hover:bg-[#c90ad0] disabled:opacity-50 ${
                  activeThread.selectedCopyKey &&
                  activeThread.promoCopyByKey[activeThread.selectedCopyKey]
                    ? "ring-2 ring-[#EB0EF5]/65 ring-offset-2 ring-offset-[#26292b]"
                    : ""
                }`}
              >
                <FourPointStarIcon className="size-5 drop-shadow-sm" />
              </button>
            </div>
          ) : null}

          {panelMode === "kv" && showFileUploadsPanel ? (
            <div
              ref={uploadsSectionRef}
              className="mt-3 space-y-2 border-t border-white/10 pt-3"
            >
              {kvCampaignRadios}
              {chongbangParamFields}
              {starCollectParamFields}
              {wheelParamFields}
              <p
                className={`rounded-xl border px-3 py-2 text-xs ${
                  activeThread.selected.length > 0
                    ? "border-[#EB0EF5]/50 bg-[#EB0EF5]/10 text-[#f0a8fc]"
                    : "border-white/10 bg-black/25 text-white/45"
                }`}
              >
                <span className="font-medium text-white/70">已选方向：</span>
                {activeThread.selected.length > 0
                  ? [...activeThread.selected].sort().join("、")
                  : "—"}
                {activeThread.selected.length > 0 ? `（${activeThread.selected.length}）` : null}
              </p>
              <ul className="grid gap-2 sm:grid-cols-1 sm:grid-cols-2">
                {studioRefRows.map(({ slot, label }) => {
                  const chosen = slot === "style" ? styleFile : slot === "ip" ? ipFile : coinFile;
                  return (
                    <li key={slot}>
                      <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 ring-1 ring-white/[0.04] transition-colors hover:border-white/15">
                        <span className="text-[11px] font-medium text-white/50">{label}</span>
                        <div className="flex min-h-[2rem] items-center gap-2">
                          <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/85">
                            选择文件
                          </span>
                          <span
                            className="min-w-0 truncate text-[10px] text-white/40"
                            title={chosen?.name}
                          >
                            {chosen ? chosen.name : "未选择"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => onRefImageChange(slot, e.target.files?.[0] ?? null)}
                          />
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {loading ? <p className="mt-2 text-xs text-[#f576f7]">处理中…</p> : null}
          </div>
        </div>
      ) : null}

      {kvPromoDialogOpen && promoDialogTarget ? (
        <div
          className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="presentation"
          onClick={() => setKvPromoDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#26292b] p-5 shadow-2xl backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kv-promo-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="kv-promo-dialog-title" className="text-base font-semibold text-zinc-50">
              方案 {promoDialogTarget.dirKey} · 推广文案
            </h2>
            <label className="mt-4 block text-xs text-zinc-500">
              备注（可选）
              <input
                type="text"
                value={promoDialogInput}
                onChange={(e) => setPromoDialogInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (!loading) void submitKvPromoDialog();
                }}
                placeholder="可选"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                autoFocus
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setKvPromoDialogOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitKvPromoDialog()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c90ad0] disabled:opacity-50"
              >
                <FourPointStarIcon className="size-[1.05rem] shrink-0 opacity-95" />
                推广文案
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
