"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DirectionRFNode } from "../types";

export function DirectionNode({ data }: NodeProps<DirectionRFNode>) {
  return (
    <div
      className={`nopan relative w-[220px] cursor-pointer rounded-2xl border-2 px-3 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-150 select-none ${
        data.selected
          ? "border-violet-400 bg-violet-500/20 shadow-violet-500/20 ring-2 ring-violet-400/50"
          : "border-zinc-600 bg-zinc-900/95 hover:border-zinc-500 hover:bg-zinc-900"
      }`}
      onClick={() => data.onToggle()}
      role="button"
      tabIndex={0}
      aria-pressed={data.selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          data.onToggle();
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-zinc-500" />
      <div
        className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          data.selected
            ? "bg-violet-500 text-white shadow-sm"
            : "border border-zinc-600 bg-zinc-800/90 text-zinc-500"
        }`}
      >
        {data.selected ? "✓ 已选" : "未选"}
      </div>
      <div className="mb-1 flex items-center gap-2 pr-14">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
            data.selected ? "bg-violet-600 text-white" : "bg-zinc-800 text-violet-300"
          }`}
        >
          {data.key}
        </span>
        <span
          className={`truncate text-xs font-medium ${data.selected ? "text-zinc-100" : "text-zinc-400"}`}
        >
          {data.title}
        </span>
      </div>
      <p className="line-clamp-5 text-xs leading-relaxed text-zinc-300">{data.content || "（无描述）"}</p>
      <p className="mt-2 text-[10px] text-zinc-500">
        点击切换 · 可同时选中多个 · 底部栏会显示已选列表
      </p>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-violet-500" />
    </div>
  );
}
