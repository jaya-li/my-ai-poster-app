"use client";

import type { DirectionOption } from "@/lib/types";

type Props = {
  options: DirectionOption[];
  selected: ("A" | "B" | "C" | "D")[];
  onToggle: (key: "A" | "B" | "C" | "D", checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

export function DirectionPicker({ options, selected, onToggle, onSelectAll, onClear }: Props) {
  if (options.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">2. 选择方向</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-md border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-600"
          >
            全选（将依次生成 4 张）
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-600"
          >
            清空
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {options.map((item) => (
          <li
            key={item.key}
            className="flex gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <input
              type="checkbox"
              id={`dir-${item.key}`}
              checked={selected.includes(item.key)}
              onChange={(e) => onToggle(item.key, e.target.checked)}
              className="mt-1"
            />
            <label htmlFor={`dir-${item.key}`} className="cursor-pointer text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">{item.key}</span>
              <span className="mx-1 text-zinc-400">·</span>
              {item.content || "（未解析到内容，可重试生成方向）"}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
