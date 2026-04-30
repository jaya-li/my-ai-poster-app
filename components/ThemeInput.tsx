"use client";

import { FourPointStarIcon } from "@/components/icons/FourPointStarIcon";

type Props = {
  theme: string;
  onThemeChange: (v: string) => void;
  onGenerateDirections: () => void;
  loading: boolean;
};

export function ThemeInput({
  theme,
  onThemeChange,
  onGenerateDirections,
  loading,
}: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">1. 主题</h2>
      <input
        value={theme}
        onChange={(e) => onThemeChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          if (!loading && theme.trim()) onGenerateDirections();
        }}
        placeholder="活动主题"
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerateDirections}
          disabled={loading || !theme.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <FourPointStarIcon className="size-[1.05rem] shrink-0 dark:text-zinc-900" />
          生成 A/B/C/D 方向
        </button>
      </div>
    </section>
  );
}
