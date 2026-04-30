"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { KvResultRFNode } from "../types";

export function KvResultNode({ data }: NodeProps<KvResultRFNode>) {
  const canPrev = data.historyCount > 1 && data.historyIndex > 0;
  const canNext = data.historyCount > 1 && data.historyIndex < data.historyCount - 1;

  return (
    <div
      className={`nopan w-[260px] cursor-pointer overflow-hidden rounded-[28px] bg-[#26292b] shadow-lg ring-1 ring-white/[0.1] transition-all ${
        data.selected ? "ring-[#EB0EF5]/40" : ""
      } ${
        data.anchorFocused
          ? "z-[2] ring-2 ring-[#EB0EF5] ring-offset-2 ring-offset-[#1a1a1a] shadow-[0_0_26px_-6px_rgba(235,14,245,0.5)]"
          : data.selected
            ? "ring-2 ring-[#EB0EF5]/35"
            : ""
      }`}
      role="group"
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-white/35" />
      <div className="flex items-center justify-between gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="text-center text-xs font-medium text-white/80">主视觉 · {data.optionKey}</span>
        <button
          type="button"
          className="nodrag nopan shrink-0 rounded-lg bg-[#EB0EF5] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#c90ad0]"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenPromo();
          }}
        >
          生文案
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.imageUrl}
        alt={`${data.optionKey} 主视觉`}
        className="pointer-events-none h-auto w-full bg-black/40 object-contain"
      />
      <div className="flex items-center justify-between gap-1 border-t border-white/10 bg-black/25 px-1 py-1">
        <button
          type="button"
          className="nodrag nopan rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30"
          disabled={!canPrev}
          onClick={(e) => {
            e.stopPropagation();
            data.onHistoryPrev();
          }}
          aria-label="上一张"
        >
          ◀
        </button>
        <span className="text-[10px] text-white/40">
          {data.historyCount > 0 ? `${data.historyIndex + 1} / ${data.historyCount}` : "—"}
        </span>
        <button
          type="button"
          className="nodrag nopan rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30"
          disabled={!canNext}
          onClick={(e) => {
            e.stopPropagation();
            data.onHistoryNext();
          }}
          aria-label="下一张"
        >
          ▶
        </button>
      </div>
      <div className="space-y-1 border-t border-white/10 px-2 py-1.5">
        <label className="block text-[10px] text-white/45">
          画面调整
          <textarea
            className="nodrag nopan mt-0.5 w-full resize-y rounded-lg border border-white/15 bg-black/35 px-2 py-1 text-[11px] text-white/90 placeholder:text-white/30"
            rows={2}
            placeholder="可选"
            value={data.refineDraft}
            onChange={(e) => data.onRefineDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.stopPropagation();
                if (!data.refineBusy) data.onRefine();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </label>
        <button
          type="button"
          disabled={data.refineBusy}
          className="nodrag nopan w-full rounded-lg bg-[#EB0EF5] py-1.5 text-[11px] font-medium text-white hover:bg-[#c90ad0] disabled:opacity-45"
          onClick={(e) => {
            e.stopPropagation();
            data.onRefine();
          }}
        >
          {data.refineBusy ? "生成中…" : "重新生成"}
        </button>
      </div>
      <a
        href={data.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="nodrag nopan block border-t border-white/10 px-2 py-1.5 text-center text-[10px] text-[#EB0EF5] hover:text-[#f576f7]"
        onClick={(e) => e.stopPropagation()}
      >
        新标签打开原图
      </a>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-[#EB0EF5]/90" />
    </div>
  );
}
