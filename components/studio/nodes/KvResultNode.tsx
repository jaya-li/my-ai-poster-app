"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { KvResultRFNode } from "../types";

export function KvResultNode({ data }: NodeProps<KvResultRFNode>) {
  return (
    <div
      className={`nopan w-[260px] cursor-pointer overflow-hidden rounded-2xl border-2 bg-zinc-900/95 shadow-xl backdrop-blur-sm transition-all ${
        data.selected
          ? "border-violet-400 shadow-violet-500/25 ring-2 ring-violet-400/45"
          : "border-zinc-600 hover:border-zinc-500"
      }`}
      onClick={() => data.onSelect()}
      role="button"
      tabIndex={0}
      aria-pressed={data.selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          data.onSelect();
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-emerald-500" />
      <div className="flex items-center justify-between border-b border-zinc-700 px-2 py-1.5">
        <span className="text-center text-xs font-medium text-zinc-300">主视觉 · {data.optionKey}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            data.selected ? "bg-violet-500 text-white" : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {data.selected ? "已点选" : "点选生文案"}
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.imageUrl}
        alt={`${data.optionKey} 主视觉`}
        className="pointer-events-none h-auto w-full bg-zinc-950 object-contain"
      />
      <a
        href={data.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="nodrag nopan block border-t border-zinc-700 px-2 py-1.5 text-center text-[10px] text-violet-400 hover:text-violet-300"
        onClick={(e) => e.stopPropagation()}
      >
        新标签打开原图
      </a>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-emerald-500" />
    </div>
  );
}
