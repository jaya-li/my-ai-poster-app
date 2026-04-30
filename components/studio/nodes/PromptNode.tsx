"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PromptRFNode } from "../types";

const anchorRing =
  "ring-2 ring-[#EB0EF5] ring-offset-2 ring-offset-[#1a1a1a] shadow-[0_0_24px_-6px_rgba(235,14,245,0.45)]";

/** Figma「用户气泡」式主题节点 */
export function PromptNode({ data }: NodeProps<PromptRFNode>) {
  return (
    <div
      className={`min-w-[260px] max-w-[400px] rounded-[28px] border-[3px] border-white/12 bg-[rgba(235,14,245,0.14)] px-5 py-4 shadow-lg transition-[box-shadow,ring] duration-150 ${
        data.anchorFocused ? anchorRing : ""
      }`}
    >
      <div className="mb-1 text-[11px] font-medium tracking-wide text-white/45">主题</div>
      <p className="text-sm leading-relaxed text-white">{data.label}</p>
      {data.status === "loading" ? (
        <p className="mt-2 text-xs text-[#f576f7]/90">正在生成 A/B/C/D 方向…</p>
      ) : null}
      {data.status === "error" && data.errorMessage ? (
        <p className="mt-2 text-xs text-red-400">{data.errorMessage}</p>
      ) : null}
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-white/35" />
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-[#EB0EF5]/90" />
    </div>
  );
}
