"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DirectionRFNode } from "../types";

const SELECT_DELAY_MS = 300;

export function DirectionNode({ data }: NodeProps<DirectionRFNode>) {
  const toggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState<"title" | "content" | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const cancelToggleTimer = useCallback(() => {
    if (toggleTimer.current) {
      clearTimeout(toggleTimer.current);
      toggleTimer.current = null;
    }
  }, []);

  useEffect(() => () => cancelToggleTimer(), [cancelToggleTimer]);

  const scheduleToggle = useCallback(() => {
    cancelToggleTimer();
    toggleTimer.current = setTimeout(() => {
      toggleTimer.current = null;
      data.onToggle();
    }, SELECT_DELAY_MS);
  }, [cancelToggleTimer, data]);

  const beginTitleEdit = () => {
    cancelToggleTimer();
    setEditing("title");
    setDraftTitle(data.title);
  };

  const beginContentEdit = () => {
    cancelToggleTimer();
    setEditing("content");
    setDraftContent(data.content);
  };

  const commitTitle = (v: string) => {
    const t = v.trim();
    if (t !== data.title.trim()) {
      data.onOptionCommit({ title: t });
    }
    setEditing(null);
  };

  const commitContent = (v: string) => {
    const t = v.trim();
    if (t !== (data.content || "").trim()) {
      data.onOptionCommit({ content: t });
    }
    setEditing(null);
  };

  return (
    <div
      className={`nopan relative min-h-[130px] w-[240px] cursor-pointer rounded-[28px] px-4 py-3 shadow-md ring-1 ring-white/[0.1] transition-all duration-150 select-none ${
        data.selected ? "bg-[#26292b]/95 shadow-[0_0_24px_-10px_rgba(235,14,245,0.2)] ring-[#EB0EF5]/35" : "bg-[#26292b] hover:ring-white/20"
      } ${
        data.anchorFocused
          ? "z-[2] ring-2 ring-[#EB0EF5] ring-offset-2 ring-offset-[#1a1a1a] shadow-[0_0_22px_-5px_rgba(235,14,245,0.45)]"
          : data.selected
            ? ""
            : ""
      }`}
      onClick={scheduleToggle}
      role="button"
      tabIndex={0}
      aria-pressed={data.selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          scheduleToggle();
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-white/35" />
      <div
        className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          data.selected ? "bg-[#EB0EF5]/90 text-white shadow-sm" : "border border-white/15 bg-black/25 text-white/45"
        }`}
      >
        {data.selected ? "✓ 已选" : "未选"}
      </div>
      <div className="mb-1 flex items-start gap-2 pr-12">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black">
          {data.key}
        </span>
        {editing === "title" ? (
          <input
            type="text"
            className="nodrag nopan min-w-0 flex-1 rounded-lg border border-[#EB0EF5]/40 bg-black/30 px-1.5 py-0.5 text-xs font-medium text-white"
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={(e: FocusEvent<HTMLInputElement>) => commitTitle(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`min-w-0 flex-1 truncate text-xs font-medium ${data.selected ? "text-white" : "text-white/55"}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              beginTitleEdit();
            }}
          >
            {data.title}
          </span>
        )}
      </div>
      {editing === "content" ? (
        <textarea
          className="nodrag nopan w-full resize-y rounded-lg border border-[#EB0EF5]/40 bg-black/30 px-2 py-1 text-xs leading-relaxed text-white/85"
          rows={5}
          autoFocus
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          onBlur={(e) => commitContent(e.currentTarget.value)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className="line-clamp-5 text-xs leading-relaxed text-white/75"
          onDoubleClick={(e) => {
            e.stopPropagation();
            beginContentEdit();
          }}
        >
          {data.content || "（无描述）"}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-[#EB0EF5]/90" />
    </div>
  );
}
