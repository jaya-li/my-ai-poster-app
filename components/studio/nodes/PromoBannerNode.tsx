"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PromoBannerRFNode } from "../types";

export function PromoBannerNode({ data }: NodeProps<PromoBannerRFNode>) {
  return (
    <div className="nopan w-[260px] overflow-hidden rounded-2xl border-2 border-teal-600/80 bg-zinc-900/95 shadow-xl">
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-teal-500" />
      <div className="border-b border-zinc-700 px-2 py-1.5 text-center text-xs font-medium text-teal-200">
        推广图 · {data.optionKey}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.imageUrl}
        alt={`${data.optionKey} 推广图`}
        className="h-auto w-full bg-zinc-950 object-contain"
      />
      <a
        href={data.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-t border-zinc-700 px-2 py-1.5 text-center text-[10px] text-teal-400 hover:text-teal-300"
        onClick={(e) => e.stopPropagation()}
      >
        新标签打开原图
      </a>
    </div>
  );
}
