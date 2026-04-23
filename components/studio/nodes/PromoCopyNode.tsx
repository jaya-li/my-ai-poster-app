"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PromoCopyRFNode } from "../types";

export function PromoCopyNode({ data }: NodeProps<PromoCopyRFNode>) {
  return (
    <div
      className={`nopan w-[260px] cursor-pointer rounded-2xl border-2 px-3 py-2.5 shadow-lg transition-all ${
        data.selected
          ? "border-amber-400 bg-amber-500/15 shadow-amber-500/15 ring-2 ring-amber-400/40"
          : "border-zinc-600 bg-zinc-900/95 hover:border-zinc-500"
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
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-amber-500" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-200">日文文案 · {data.optionKey}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            data.selected ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {data.selected ? "已点选" : "点选生推广图"}
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] font-medium text-zinc-100">{data.headline}</p>
      <p className="mt-1 line-clamp-2 text-[10px] text-zinc-400">{data.subheadline}</p>
      <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-zinc-500">{data.description}</p>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-amber-500" />
    </div>
  );
}
