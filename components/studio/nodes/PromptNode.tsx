"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PromptRFNode } from "../types";

export function PromptNode({ data }: NodeProps<PromptRFNode>) {
  return (
    <div className="min-w-[260px] max-w-[380px] rounded-2xl border border-zinc-600 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <div className="mb-1 text-xs font-medium tracking-wide text-zinc-500">主题</div>
      <p className="text-sm leading-relaxed text-zinc-100">{data.label}</p>
      {data.status === "loading" ? (
        <p className="mt-2 text-xs text-amber-400">正在生成 A/B/C/D 方向…</p>
      ) : null}
      {data.status === "error" && data.errorMessage ? (
        <p className="mt-2 text-xs text-red-400">{data.errorMessage}</p>
      ) : null}
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-zinc-500" />
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-violet-500" />
    </div>
  );
}
