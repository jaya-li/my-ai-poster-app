"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { copyImageHrefToClipboard, downloadImageHref } from "@/lib/client-image-export";
import type { KvResultRFNode } from "../types";

export function KvResultNode({ data }: NodeProps<KvResultRFNode>) {
  const canPrev = data.historyCount > 1 && data.historyIndex > 0;
  const canNext = data.historyCount > 1 && data.historyIndex < data.historyCount - 1;
  const exportBase = `主视觉-${data.optionKey}-${data.width}x${data.height}`;

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
      <div className="flex items-center justify-center gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="text-center text-xs font-medium text-white/80">主视觉 · {data.optionKey}</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        className="nodrag nopan relative block w-full cursor-pointer bg-black/40 text-left outline-none ring-[#EB0EF5]/35 focus-visible:ring-2"
        onClick={(e) => {
          e.stopPropagation();
          data.onActivateEditPanel();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            data.onActivateEditPanel();
          }
        }}
        aria-label="打开改图面板"
        title="左键打开改图；在图片上右键可「将图像复制/存储为」"
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl}
            alt={`${data.optionKey} 主视觉`}
            className="pointer-events-auto h-auto w-full max-w-full object-contain opacity-100 select-none"
            draggable={false}
          />
          {data.adjustmentBusy ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-medium text-white/90 backdrop-blur-[2px]">
              生成中…
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
              <span className="rounded-md bg-black/55 px-2 py-0.5 text-[9px] text-white/85 backdrop-blur-sm">
                点图改画面
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 border-t border-white/10 px-1.5 py-1">
        <button
          type="button"
          className="nodrag nopan rounded-md border border-white/15 bg-black/35 py-1 text-[10px] font-medium text-white/85 hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            void downloadImageHref(data.imageUrl, `${exportBase}.png`).catch((err) =>
              alert(err instanceof Error ? err.message : "保存失败")
            );
          }}
        >
          保存图片
        </button>
        <button
          type="button"
          className="nodrag nopan rounded-md border border-white/15 bg-black/35 py-1 text-[10px] font-medium text-white/85 hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            void copyImageHrefToClipboard(data.imageUrl).catch((err) =>
              alert(err instanceof Error ? err.message : "复制失败")
            );
          }}
        >
          复制图片
        </button>
      </div>
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
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className="nodrag nopan rounded-lg bg-[#EB0EF5] py-1.5 text-[11px] font-medium text-white hover:bg-[#c90ad0]"
            onClick={(e) => {
              e.stopPropagation();
              data.onOpenPromo();
            }}
          >
            写文案
          </button>
          <button
            type="button"
            disabled={data.removeUiBusy}
            className="nodrag nopan rounded-lg border border-white/20 bg-black/30 py-1.5 text-[11px] font-medium text-white/90 hover:bg-white/10 disabled:opacity-45"
            onClick={(e) => {
              e.stopPropagation();
              data.onRemoveUi();
            }}
          >
            {data.removeUiBusy ? "生成中…" : "去UI"}
          </button>
        </div>
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
      {data.splitLayers.length > 0 ? (
        <details className="border-t border-white/10 bg-black/20 px-2 py-1.5">
          <summary className="cursor-pointer text-[10px] text-white/60">
            拆图结果（{data.splitLayers.length}）
          </summary>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {data.splitLayers.map((layer) => (
              <a
                key={layer.key}
                href={layer.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="nodrag nopan overflow-hidden rounded-md border border-white/10 bg-black/30"
                onClick={(e) => e.stopPropagation()}
                title={layer.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={layer.imageUrl} alt={layer.label} className="h-16 w-full object-cover" />
                <p className="truncate px-1 py-0.5 text-center text-[9px] text-white/75">{layer.label}</p>
              </a>
            ))}
          </div>
        </details>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-[#EB0EF5]/90" />
    </div>
  );
}
