"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PromoCopyRFNode } from "../types";

type TextField = "headline" | "subheadline" | "description";

const SELECT_DELAY_MS = 300;

export function PromoCopyNode({ data }: NodeProps<PromoCopyRFNode>) {
  const selectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState<TextField | null>(null);
  const [draft, setDraft] = useState({ headline: "", subheadline: "", description: "" });

  const cancelSelectTimer = useCallback(() => {
    if (selectTimer.current) {
      clearTimeout(selectTimer.current);
      selectTimer.current = null;
    }
  }, []);

  useEffect(() => () => cancelSelectTimer(), [cancelSelectTimer]);

  const scheduleSelect = useCallback(() => {
    cancelSelectTimer();
    selectTimer.current = setTimeout(() => {
      selectTimer.current = null;
      data.onSelect();
    }, SELECT_DELAY_MS);
  }, [cancelSelectTimer, data]);

  const beginEdit = (field: TextField) => {
    cancelSelectTimer();
    setEditing(field);
    setDraft({
      headline: data.headline,
      subheadline: data.subheadline,
      description: data.description,
    });
  };

  const commitField = useCallback(
    (field: TextField, value: string) => {
      const trimmed = value.trim();
      const prev =
        field === "headline"
          ? data.headline
          : field === "subheadline"
            ? data.subheadline
            : data.description;
      if (trimmed !== prev.trim()) {
        data.onPromoCopyCommit({ [field]: trimmed });
      }
      setEditing(null);
    },
    [data]
  );

  const onBlur =
    (field: TextField) =>
    (e: FocusEvent<HTMLTextAreaElement>): void => {
      commitField(field, e.currentTarget.value);
    };

  return (
    <div
      className={`nopan w-[260px] cursor-pointer rounded-[28px] bg-[#26292b] px-3 py-2.5 shadow-lg ring-1 ring-white/[0.1] transition-all duration-150 hover:ring-white/15 ${
        data.selected ? "ring-[#EB0EF5]/40" : ""
      } ${
        data.anchorFocused
          ? "z-[2] ring-2 ring-[#EB0EF5] ring-offset-2 ring-offset-[#1a1a1a] shadow-[0_0_22px_-5px_rgba(235,14,245,0.45)]"
          : data.selected
            ? "ring-2 ring-[#EB0EF5]/35"
            : ""
      }`}
      onClick={scheduleSelect}
      role="button"
      tabIndex={0}
      aria-pressed={data.selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          scheduleSelect();
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-[#EB0EF5]/90" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/85">推广文案 · {data.optionKey}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            data.selected ? "bg-[#EB0EF5] text-white" : "bg-white/10 text-white/45"
          }`}
        >
          {data.selected ? "已点选" : "点选生推广图"}
        </span>
      </div>
      {editing === "headline" ? (
        <textarea
          className="nodrag nopan mt-0.5 w-full resize-y rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] font-medium text-white/90 outline-none focus:border-[#EB0EF5]/50"
          rows={2}
          autoFocus
          value={draft.headline}
          onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
          onBlur={onBlur("headline")}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className="line-clamp-2 text-[11px] font-medium text-white/90"
          onDoubleClick={(e) => {
            e.stopPropagation();
            beginEdit("headline");
          }}
        >
          {data.headline}
        </p>
      )}
      {editing === "subheadline" ? (
        <textarea
          className="nodrag nopan mt-1 w-full resize-y rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] text-white/75 outline-none focus:border-[#EB0EF5]/50"
          rows={2}
          autoFocus
          value={draft.subheadline}
          onChange={(e) => setDraft((d) => ({ ...d, subheadline: e.target.value }))}
          onBlur={onBlur("subheadline")}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className="mt-1 line-clamp-2 text-[10px] text-white/55"
          onDoubleClick={(e) => {
            e.stopPropagation();
            beginEdit("subheadline");
          }}
        >
          {data.subheadline}
        </p>
      )}
      {editing === "description" ? (
        <textarea
          className="nodrag nopan mt-1 w-full resize-y rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] leading-relaxed text-white/60 outline-none focus:border-[#EB0EF5]/50"
          rows={3}
          autoFocus
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          onBlur={onBlur("description")}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-white/50"
          onDoubleClick={(e) => {
            e.stopPropagation();
            beginEdit("description");
          }}
        >
          {data.description}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-[#EB0EF5]/90" />
    </div>
  );
}
