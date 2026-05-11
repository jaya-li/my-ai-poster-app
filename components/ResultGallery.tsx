"use client";

import { FourPointStarIcon } from "@/components/icons/FourPointStarIcon";
import { copyImageHrefToClipboard, downloadImageHref } from "@/lib/client-image-export";
import type { DirectionOption, GeneratedImageResult } from "@/lib/types";

type Props = {
  results: GeneratedImageResult[];
  options: DirectionOption[];
  promoSourceKey: "A" | "B" | "C" | "D" | null;
  onPromoSourceKeyChange: (key: "A" | "B" | "C" | "D") => void;
  onRegenerateKv: () => void;
  onContinuePromo: () => void;
  loading: boolean;
};

export function ResultGallery({
  results,
  options,
  promoSourceKey,
  onPromoSourceKeyChange,
  onRegenerateKv,
  onContinuePromo,
  loading,
}: Props) {
  if (results.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">4. 主视觉结果</h2>

      {results.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">推广图源</span>
          <select
            value={promoSourceKey ?? results[0]?.optionKey ?? "A"}
            onChange={(e) => onPromoSourceKeyChange(e.target.value as "A" | "B" | "C" | "D")}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
          >
            {results.map((r) => (
              <option key={r.optionKey} value={r.optionKey}>
                {r.optionKey} — {options.find((o) => o.key === r.optionKey)?.title ?? r.optionKey}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-8">
        {results.map((item) => (
          <article key={item.optionKey} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">{item.optionKey} 方案</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={`${item.optionKey} 主视觉`}
              className="max-h-[480px] w-auto max-w-full rounded-lg border border-zinc-100 object-contain select-none dark:border-zinc-800"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() =>
                  void downloadImageHref(
                    item.imageUrl,
                    `主视觉-${item.optionKey}-${item.width}x${item.height}.png`
                  ).catch((e) => alert(e instanceof Error ? e.message : "保存失败"))
                }
              >
                保存图片
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() =>
                  void copyImageHrefToClipboard(item.imageUrl).catch((e) =>
                    alert(e instanceof Error ? e.message : "复制失败")
                  )
                }
              >
                复制图片
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              也可在上方缩略图上右键使用浏览器自带的「将图像存储为…」「复制图像」。
            </p>
            <details className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                生图 prompt
              </summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {item.prompt}
              </pre>
            </details>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRegenerateKv}
          disabled={loading}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          重新生成主视觉
        </button>
        <button
          type="button"
          onClick={onContinuePromo}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c90ad0] disabled:opacity-50"
        >
          <FourPointStarIcon className="size-[1.05rem] shrink-0 opacity-95" />
          继续：生成推广文案
        </button>
      </div>
    </section>
  );
}
