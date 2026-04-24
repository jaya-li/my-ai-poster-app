"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { compressLayoutFile, compressIpRefFile, compressRefFile } from "@/lib/client-image";
import { layoutStudioNodes } from "@/lib/studio/layout-graph";
import { parseApiJson } from "@/lib/parse-api-response";
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

type FileSlot = "layout" | "style" | "ip" | "coin";

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

type PromptStatus = "idle" | "loading" | "done" | "error";

const studioEdgeStyle: CSSProperties = { stroke: "#8b5cf6", strokeWidth: 2 };

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

function mergeNodeDataPreservePosition(prev: Node[], fresh: Node[]): Node[] {
  const pos = new Map(prev.map((n) => [n.id, n.position]));
  return fresh.map((n) => ({
    ...n,
    position: pos.get(n.id) ?? n.position,
  }));
}

type StudioPanelMode = "prompt" | "direction" | "kv" | "copy" | "banner";

function getStudioPanelMode(anchorId: string): StudioPanelMode {
  if (anchorId === "prompt") return "prompt";
  if (anchorId.startsWith("dir-")) return "direction";
  if (anchorId.startsWith("kv-")) return "kv";
  if (anchorId.startsWith("copy-")) return "copy";
  if (anchorId.startsWith("banner-")) return "banner";
  return "prompt";
}

function dirKeyFromAnchorId(anchorId: string): DirKey | null {
  if (anchorId.startsWith("dir-")) return anchorId.slice(4) as DirKey;
  if (anchorId.startsWith("kv-")) return anchorId.slice(3) as DirKey;
  if (anchorId.startsWith("copy-")) return anchorId.slice(5) as DirKey;
  if (anchorId.startsWith("banner-")) return anchorId.slice(7) as DirKey;
  return null;
}

function buildStudioGraph(params: {
  themeDraft: string;
  committedTheme: string | null;
  promptStatus: PromptStatus;
  promptError?: string;
  options: DirectionOption[];
  selected: DirKey[];
  results: GeneratedImageResult[];
  selectedKvKey: DirKey | null;
  selectedCopyKey: DirKey | null;
  promoCopyByKey: Partial<Record<DirKey, PromoCopy>>;
  promoBannerByKey: Partial<Record<DirKey, PromoBanner>>;
  toggleDirection: (key: DirKey) => void;
  onSelectKv: (key: DirKey) => void;
  onSelectCopy: (key: DirKey) => void;
}): { nodes: Node[]; edges: Edge[] } {
  const {
    themeDraft,
    committedTheme,
    promptStatus,
    promptError,
    options,
    selected,
    results,
    selectedKvKey,
    selectedCopyKey,
    promoCopyByKey,
    promoBannerByKey,
    toggleDirection,
    onSelectKv,
    onSelectCopy,
  } = params;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  /** RF 在不可选、不可拖且未传 onNodeClick 时会把节点设为 pointer-events:none，点击会穿透；显式打开才能点到自定义内容 */
  const pointerAll = { pointerEvents: "all" as const };

  const displayLabel =
    committedTheme?.trim() ||
    themeDraft.trim() ||
    "在附着面板填写主题，点「生成」得到四方向";

  nodes.push({
    id: "prompt",
    type: "prompt",
    position: { x: 0, y: 0 },
    style: pointerAll,
    data: {
      label: displayLabel,
      status: committedTheme ? promptStatus : "idle",
      errorMessage: committedTheme ? promptError : undefined,
    },
  });

  if (!committedTheme) {
    return { nodes, edges };
  }

  for (const opt of options) {
    const id = `dir-${opt.key}`;
    nodes.push({
      id,
      type: "direction",
      position: { x: 0, y: 0 },
      style: pointerAll,
      data: {
        ...opt,
        selected: selected.includes(opt.key),
        onToggle: () => toggleDirection(opt.key),
      },
    });
    edges.push(
      makeStudioEdge(`e-prompt-${opt.key}`, "prompt", id, {
        animated: promptStatus === "loading",
      })
    );
  }

  for (const r of results) {
    const dirId = `dir-${r.optionKey}`;
    const kvId = `kv-${r.optionKey}`;
    nodes.push({
      id: kvId,
      type: "kvResult",
      position: { x: 0, y: 0 },
      style: pointerAll,
      data: {
        optionKey: r.optionKey,
        imageUrl: r.imageUrl,
        prompt: r.prompt,
        selected: selectedKvKey === r.optionKey,
        onSelect: () => onSelectKv(r.optionKey),
      },
    });
    edges.push(makeStudioEdge(`e-dir-kv-${r.optionKey}`, dirId, kvId));

    const copyData = promoCopyByKey[r.optionKey];
    if (copyData) {
      const copyId = `copy-${r.optionKey}`;
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
          onSelect: () => onSelectCopy(r.optionKey),
        },
      });
      edges.push(makeStudioEdge(`e-kv-copy-${r.optionKey}`, kvId, copyId));
    }

    const bannerData = promoBannerByKey[r.optionKey];
    if (bannerData && copyData) {
      const copyId = `copy-${r.optionKey}`;
      const bannerId = `banner-${r.optionKey}`;
      nodes.push({
        id: bannerId,
        type: "promoBanner",
        position: { x: 0, y: 0 },
        style: pointerAll,
        data: {
          optionKey: r.optionKey,
          imageUrl: bannerData.imageUrl,
          width: bannerData.width,
          height: bannerData.height,
        },
      });
      edges.push(makeStudioEdge(`e-copy-banner-${r.optionKey}`, copyId, bannerId));
    }
  }

  return { nodes, edges };
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

const fileRows: { slot: FileSlot; label: string; required?: boolean }[] = [
  { slot: "layout", label: "图1 版式", required: true },
  { slot: "style", label: "图2 风格" },
  { slot: "ip", label: "图3 IP" },
  { slot: "coin", label: "图4 金币" },
];

export function StudioCanvas() {
  const [themeDraft, setThemeDraft] = useState("");
  const [committedTheme, setCommittedTheme] = useState<string | null>(null);
  const [promptStatus, setPromptStatus] = useState<PromptStatus>("idle");
  const [promptError, setPromptError] = useState<string | undefined>();
  const [options, setOptions] = useState<DirectionOption[]>([]);
  const [selected, setSelected] = useState<DirKey[]>([]);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [coinFile, setCoinFile] = useState<File | null>(null);
  const [results, setResults] = useState<GeneratedImageResult[]>([]);
  const [promoCopyByKey, setPromoCopyByKey] = useState<Partial<Record<DirKey, PromoCopy>>>({});
  const [promoBannerByKey, setPromoBannerByKey] = useState<Partial<Record<DirKey, PromoBanner>>>({});
  const [loading, setLoading] = useState(false);
  const [selectedKvKey, setSelectedKvKey] = useState<DirKey | null>(null);
  const [selectedCopyKey, setSelectedCopyKey] = useState<DirKey | null>(null);
  const [kvPromoDialogOpen, setKvPromoDialogOpen] = useState(false);
  const [promoDialogInput, setPromoDialogInput] = useState("");

  const openKvPromoDialog = useCallback((key: DirKey) => {
    setSelectedKvKey(key);
    setKvPromoDialogOpen(true);
    setPromoDialogInput("");
    setPromoCopyByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPromoBannerByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelectedCopyKey((k) => (k === key ? null : k));
  }, []);

  const onSelectCopy = useCallback((key: DirKey) => {
    setSelectedCopyKey(key);
  }, []);

  const toggleDirection = useCallback((key: DirKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const onFileChange = useCallback((slot: FileSlot, file: File | null) => {
    switch (slot) {
      case "layout":
        setLayoutFile(file);
        break;
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

  const computed = useMemo(() => {
    const raw = buildStudioGraph({
      themeDraft,
      committedTheme,
      promptStatus,
      promptError,
      options,
      selected,
      results,
      selectedKvKey,
      selectedCopyKey,
      promoCopyByKey,
      promoBannerByKey,
      toggleDirection,
      onSelectKv: openKvPromoDialog,
      onSelectCopy,
    });
    const laidOut = layoutStudioNodes(raw.nodes, raw.edges);
    const sig = `${[...laidOut.map((n) => n.id)].sort().join("|")}__${[...raw.edges.map((e) => e.id)].sort().join("|")}`;
    return { nodes: laidOut, edges: raw.edges, sig };
  }, [
    themeDraft,
    committedTheme,
    promptStatus,
    promptError,
    options,
    selected,
    results,
    selectedKvKey,
    selectedCopyKey,
    promoCopyByKey,
    promoBannerByKey,
    toggleDirection,
    openKvPromoDialog,
    onSelectCopy,
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

  const [preferredAnchorId, setPreferredAnchorId] = useState<string | null>(null);

  const effectiveAnchorId = useMemo(() => {
    if (nodes.length === 0) return null;
    if (preferredAnchorId && nodes.some((n) => n.id === preferredAnchorId)) {
      return preferredAnchorId;
    }
    return nodes.find((n) => n.id === "prompt")?.id ?? nodes[0]!.id;
  }, [nodes, preferredAnchorId]);

  useEffect(() => {
    if (!kvPromoDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKvPromoDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kvPromoDialogOpen]);

  async function handleGenerateDirections() {
    const t = themeDraft.trim();
    if (!t) {
      alert("请输入主题");
      return;
    }

    setLoading(true);
    setCommittedTheme(t);
    setPromptStatus("loading");
    setPromptError(undefined);
    setOptions([]);
    setSelected([]);
    setResults([]);
    setPromoCopyByKey({});
    setPromoBannerByKey({});
    setSelectedKvKey(null);
    setSelectedCopyKey(null);
    setKvPromoDialogOpen(false);

    try {
      const res = await fetch("/api/theme-directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: t }),
      });
      const data = await parseApiJson<{ options: DirectionOption[]; error?: string }>(res);
      setOptions(data.options);
      setPromptStatus("done");
    } catch (e: unknown) {
      setPromptStatus("error");
      setPromptError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  async function buildKvBody() {
    const theme = themeDraft.trim() || committedTheme || "";
    return {
      theme,
      selectedOptions: selected,
      optionContents: options,
      images: {
        layoutBase64: layoutFile ? await compressLayoutFile(layoutFile) : undefined,
        styleBase64: styleFile ? await compressRefFile(styleFile) : undefined,
        ipBase64: ipFile ? await compressIpRefFile(ipFile) : undefined,
        coinBase64: coinFile ? await compressRefFile(coinFile) : undefined,
      },
    };
  }

  async function handleGenerateKv() {
    if (!layoutFile) {
      alert("请先上传图1（版式锁定参考）");
      return;
    }
    if (selected.length === 0) {
      alert("请至少选择一个方向");
      return;
    }

    setLoading(true);
    try {
      const body = await buildKvBody();
      const res = await fetch("/api/generate-kv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseApiJson<{
        results: GeneratedImageResult[];
        error?: string;
      }>(res);
      setResults(data.results);
      setPromoCopyByKey({});
      setPromoBannerByKey({});
      setSelectedKvKey(null);
      setSelectedCopyKey(null);
      setKvPromoDialogOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  /**
   * 共用「生成」：
   * 1) 已选中文案节点 → 出推广图
   * 2) 已出四方向 + 已选方向 + 图1 → 出主视觉
   * 3) 否则 → 按主题生成/刷新 A/B/C/D（需填写主题）
   */
  async function handlePrimaryGenerate() {
    if (selectedCopyKey && promoCopyByKey[selectedCopyKey]) {
      await submitBannerFromFooter();
      return;
    }

    const t = themeDraft.trim();
    if (!t) {
      alert("请输入主题");
      return;
    }

    if (options.length > 0 && selected.length > 0) {
      if (!layoutFile) {
        alert("生成主视觉请先上传图1（版式锁定参考）；图2–4 可选。");
        return;
      }
      await handleGenerateKv();
      return;
    }

    await handleGenerateDirections();
  }

  async function submitKvPromoDialog() {
    const key = selectedKvKey;
    if (!key) {
      alert("请先在画布上点选一张主视觉图");
      return;
    }
    const visual = results.find((r) => r.optionKey === key);
    const opt = options.find((o) => o.key === key);
    if (!visual || !opt) {
      alert("数据异常，请重新生成主视觉");
      return;
    }

    setLoading(true);
    try {
      const copyRes = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeDraft.trim() || committedTheme || "",
          selectedOptionKey: opt.key,
          selectedOptionContent: opt.content,
        }),
      });
      const copyData = await parseApiJson<PromoCopy & { error?: string }>(copyRes);
      setPromoCopyByKey((prev) => ({ ...prev, [key]: copyData }));
      setPromoBannerByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSelectedCopyKey(key);
      setKvPromoDialogOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  function trySubmitPromoDialogFromInput() {
    const t = promoDialogInput.trim();
    if (!t) return;
    if (/生文案|生成文案|写文案/i.test(t)) {
      void submitKvPromoDialog();
    } else {
      alert("请输入「生文案」「生成文案」或类似指令，或直接点下方按钮。");
    }
  }

  async function submitBannerFromFooter() {
    const key = selectedCopyKey;
    if (!key) {
      alert("请先在画布上点选「推广文案」节点");
      return;
    }
    const copy = promoCopyByKey[key];
    if (!copy) {
      alert("该方案暂无文案节点，请先从主视觉生成文案");
      return;
    }
    const visual = results.find((r) => r.optionKey === key);
    const opt = options.find((o) => o.key === key);
    if (!visual || !opt) {
      alert("数据异常，请重新生成主视觉");
      return;
    }

    setLoading(true);
    try {
      const bannerRes = await fetch("/api/generate-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeDraft.trim() || committedTheme || "",
          selectedOptionKey: opt.key,
          selectedOptionContent: opt.content,
          mainVisualUrl: visual.imageUrl,
          headline: copy.headline,
          subheadline: copy.subheadline,
          description: copy.description,
        }),
      });
      const bannerData = await parseApiJson<PromoBanner & { error?: string }>(bannerRes);
      setPromoBannerByKey((prev) => ({ ...prev, [key]: bannerData }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  const panelMode: StudioPanelMode = effectiveAnchorId
    ? getStudioPanelMode(effectiveAnchorId)
    : "prompt";
  const anchorKey = effectiveAnchorId ? dirKeyFromAnchorId(effectiveAnchorId) : null;

  /** 主题节点：只改主题；方案/主视觉节点：显示参考图上传（方案节点优先突出上传区） */
  const showFileUploadsPanel =
    options.length > 0 &&
    panelMode !== "prompt" &&
    panelMode !== "copy" &&
    panelMode !== "banner";

  const themeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadsSectionRef = useRef<HTMLDivElement>(null);
  const layoutFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSectionHighlight, setUploadSectionHighlight] = useState(false);

  useEffect(() => {
    if (kvPromoDialogOpen) return;
    const id = requestAnimationFrame(() => {
      if (effectiveAnchorId === "prompt") {
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

  const onStudioPanelGripPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
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
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onStudioPanelGripPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = studioPanelDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setStudioPanelPos({
      x: d.startLeft + (e.clientX - d.startClientX),
      y: d.startTop + (e.clientY - d.startClientY),
    });
  }, []);

  const onStudioPanelGripPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = studioPanelDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    studioPanelDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return (
    <div className="h-screen min-h-0 bg-zinc-950 text-zinc-100">
      <div className="h-full min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            setPreferredAnchorId(node.id);
            if (node.id.startsWith("kv-")) {
              const k = dirKeyFromAnchorId(node.id);
              if (k) openKvPromoDialog(k);
              setSelectedCopyKey(null);
              return;
            }
            if (node.id.startsWith("copy-")) {
              const k = dirKeyFromAnchorId(node.id);
              if (k) setSelectedCopyKey(k);
              return;
            }
            setSelectedCopyKey(null);
          }}
          nodeTypes={nodeTypes}
          nodesDraggable
          nodeDragThreshold={10}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          className="h-full bg-zinc-950"
        >
          <Background gap={20} size={1} color="#3f3f46" />
          <Controls className="!border-zinc-700 !bg-zinc-900 [&_button]:!border-zinc-600 [&_button]:!bg-zinc-800 [&_svg]:!fill-zinc-200" />
          <MiniMap
            className="!border-zinc-700 !bg-zinc-900"
            nodeStrokeWidth={2}
            maskColor="rgba(24,24,27,0.85)"
          />
          <AutoFit layoutKey={computed.sig} />
          <Panel position="top-right" className="m-2">
            <Link
              href="/"
              className="inline-block rounded-lg border border-zinc-600 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur hover:bg-zinc-800"
            >
              返回标准流程
            </Link>
          </Panel>
        </ReactFlow>
      </div>

      {effectiveAnchorId ? (
        <div
          ref={studioPanelRef}
          className={`fixed z-[10040] max-h-[42vh] w-[min(92vw,26rem)] overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-900/95 px-3 py-3 shadow-2xl backdrop-blur-sm sm:w-[28rem] ${
            studioPanelDocked ? "bottom-6 left-1/2 -translate-x-1/2" : ""
          }`}
          style={studioPanelDocked ? undefined : { left: studioPanelPos.x, top: studioPanelPos.y }}
        >
          <div
            className="mb-2 flex cursor-grab select-none items-center gap-2 border-b border-zinc-700 pb-2 active:cursor-grabbing"
            onPointerDown={onStudioPanelGripPointerDown}
            onPointerMove={onStudioPanelGripPointerMove}
            onPointerUp={onStudioPanelGripPointerUp}
            onPointerCancel={onStudioPanelGripPointerUp}
            onDoubleClick={(e) => {
              e.preventDefault();
              setStudioPanelDocked(true);
            }}
            title="拖动可移动面板；双击恢复到底部居中"
            aria-label="拖动面板，双击恢复到底部居中"
          >
            <span className="font-mono text-zinc-500" aria-hidden>
              ⋮⋮
            </span>
            <p className="min-w-0 flex-1 text-xs font-medium text-zinc-300">
              {panelMode === "prompt" && "当前：主题 / 四方向"}
              {panelMode === "direction" && `当前：方向 · ${anchorKey ?? "—"}`}
              {panelMode === "kv" && `当前：主视觉 · ${anchorKey ?? "—"}`}
              {panelMode === "copy" && `当前：推广文案 · ${anchorKey ?? "—"}（生成推广图）`}
              {panelMode === "banner" && `当前：推广图 · ${anchorKey ?? "—"}`}
            </p>
          </div>
          {panelMode === "kv" ? (
            <p className="mb-2 text-xs text-zinc-500">
              已保留弹窗：点击主视觉卡片会打开「生文案」对话框（也可再点一次卡片重新打开）。
            </p>
          ) : null}
          {panelMode === "banner" ? (
            <p className="text-xs text-zinc-500">
              可点选画布上其他节点切换任务；本节点为成品图。
            </p>
          ) : null}

          {panelMode === "direction" && showFileUploadsPanel ? (
            <div
              ref={uploadsSectionRef}
              className={`space-y-2 rounded-xl transition-shadow duration-300 ${
                uploadSectionHighlight
                  ? "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-zinc-900"
                  : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-xs text-zinc-400">
                  当前为<strong className="text-zinc-200">方案节点</strong>
                  ：请上传参考图（图1 版式必填）。点击下方按钮或各图一栏即可选择文件。
                </p>
                <button
                  type="button"
                  onClick={() => layoutFileInputRef.current?.click()}
                  className="shrink-0 rounded-lg border border-violet-500/50 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20"
                >
                  打开图1选择器
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {fileRows.map(({ slot, label, required }) => (
                  <li key={slot} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-zinc-400">
                      {label}
                      {required ? <span className="text-red-400"> *</span> : null}
                    </span>
                    <input
                      ref={slot === "layout" ? layoutFileInputRef : undefined}
                      type="file"
                      accept="image/*"
                      onChange={(e) => onFileChange(slot, e.target.files?.[0] ?? null)}
                      className="text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs"
                    />
                  </li>
                ))}
              </ul>
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  selected.length > 0
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                    : "border-zinc-700 bg-zinc-950/80 text-zinc-500"
                }`}
              >
                <span className="font-medium text-zinc-300">已选方向：</span>
                {selected.length > 0
                  ? [...selected].sort().join("、")
                  : "在画布上点 A/B/C/D 多选"}
                {selected.length > 0 ? `（${selected.length}）` : null}
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-3">
                <button
                  type="button"
                  onClick={() => void handlePrimaryGenerate()}
                  disabled={loading}
                  title={
                    selectedCopyKey && promoCopyByKey[selectedCopyKey]
                      ? "当前已选中文案节点：生成推广图"
                      : options.length > 0 && selected.length > 0 && layoutFile
                        ? "将按已选方向与参考图生成主视觉"
                        : options.length > 0
                          ? "将按当前主题重新生成四方向（若已选方向且已传图1则改为出主视觉）"
                          : "将生成 A/B/C/D 四方向"
                  }
                  className={`rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                    selectedCopyKey && promoCopyByKey[selectedCopyKey]
                      ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-zinc-900"
                      : ""
                  }`}
                >
                  生成
                </button>
              </div>
            </div>
          ) : null}

          {panelMode === "direction" ? (
            <details className="mt-3 border-t border-zinc-800 pt-3">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
                修改主题文本（可选）
              </summary>
              <label className="mt-2 block text-xs text-zinc-400">
                主题
                <textarea
                  value={themeDraft}
                  onChange={(e) => setThemeDraft(e.target.value)}
                  rows={2}
                  placeholder="描述活动 / 产品…"
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
                  value={themeDraft}
                  onChange={(e) => setThemeDraft(e.target.value)}
                  rows={2}
                  placeholder="描述活动 / 产品…"
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </label>
              <button
                type="button"
                onClick={() => void handlePrimaryGenerate()}
                disabled={loading}
                title={
                  selectedCopyKey && promoCopyByKey[selectedCopyKey]
                    ? "当前已选中文案节点：生成推广图"
                    : options.length > 0 && selected.length > 0 && layoutFile
                      ? "将按已选方向与参考图生成主视觉"
                      : options.length > 0
                        ? "将按当前主题重新生成四方向（若已选方向且已传图1则改为出主视觉）"
                        : "将生成 A/B/C/D 四方向"
                }
                className={`shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  selectedCopyKey && promoCopyByKey[selectedCopyKey]
                    ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-zinc-900"
                    : ""
                }`}
              >
                生成
              </button>
            </div>
          ) : null}

          {panelMode === "kv" && showFileUploadsPanel ? (
            <div
              ref={uploadsSectionRef}
              className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
            >
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  selected.length > 0
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                    : "border-zinc-700 bg-zinc-950/80 text-zinc-500"
                }`}
              >
                <span className="font-medium text-zinc-300">已选方向：</span>
                {selected.length > 0
                  ? [...selected].sort().join("、")
                  : "在画布上点 A/B/C/D 多选"}
                {selected.length > 0 ? `（${selected.length}）` : null}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {fileRows.map(({ slot, label, required }) => (
                  <li key={slot} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-zinc-400">
                      {label}
                      {required ? <span className="text-red-400"> *</span> : null}
                    </span>
                    <input
                      ref={slot === "layout" ? layoutFileInputRef : undefined}
                      type="file"
                      accept="image/*"
                      onChange={(e) => onFileChange(slot, e.target.files?.[0] ?? null)}
                      className="text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {loading ? <p className="mt-2 text-xs text-amber-400">处理中…</p> : null}
        </div>
      ) : null}

      {kvPromoDialogOpen && selectedKvKey ? (
        <div
          className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="presentation"
          onClick={() => setKvPromoDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-600 bg-zinc-900 p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kv-promo-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="kv-promo-dialog-title" className="text-base font-semibold text-zinc-50">
              方案 {selectedKvKey} · 本地化推广文案
            </h2>
            <p className="mt-2 text-xs text-zinc-400">
              将根据主题自动匹配语言与市场（如韩国→韩文、英语国家→英文等）。文案生成后出现在主视觉下方节点。输入「生文案」等后回车，或直接点下方按钮。
            </p>
            <label className="mt-4 block text-xs text-zinc-500">
              指令（可选）
              <input
                type="text"
                value={promoDialogInput}
                onChange={(e) => setPromoDialogInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    trySubmitPromoDialogFromInput();
                  }
                }}
                placeholder="例如：生文案"
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                autoFocus
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setKvPromoDialogOpen(false)}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitKvPromoDialog()}
                disabled={loading}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                生成推广文案
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
