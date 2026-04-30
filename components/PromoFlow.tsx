"use client";

import { FourPointStarIcon } from "@/components/icons/FourPointStarIcon";

type PromoCopy = {
  headline: string;
  subheadline: string;
  description: string;
  raw?: string;
};

type PromoBanner = {
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
};

type Props = {
  promoCopy: PromoCopy | null;
  promoResult: PromoBanner | null;
  onRegenerateCopy: () => void;
  onConfirmGenerateBanner: () => void;
  onRegenerateBanner: () => void;
  loading: boolean;
  /** 已存在主视觉结果时展示本区块（无需再点「继续」才出现标题） */
  hasMainVisual: boolean;
  onStartPromo: () => void;
};

export function PromoFlow({
  promoCopy,
  promoResult,
  onRegenerateCopy,
  onConfirmGenerateBanner,
  onRegenerateBanner,
  loading,
  hasMainVisual,
  onStartPromo,
}: Props) {
  if (!hasMainVisual) return null;

  return (
    <section className="space-y-6 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">5. 推广文案与推广图</h2>

      {!promoCopy ? (
        <div className="space-y-3 rounded-xl border border-[#EB0EF5]/25 bg-[#EB0EF5]/[0.06] p-4 dark:border-[#EB0EF5]/35 dark:bg-[#EB0EF5]/[0.08]">
          <button
            type="button"
            onClick={onStartPromo}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c90ad0] disabled:opacity-50"
          >
            {loading ? (
              "处理中…"
            ) : (
              <>
                <FourPointStarIcon className="size-[1.05rem] shrink-0 opacity-95" />
                生成推广文案
              </>
            )}
          </button>
        </div>
      ) : null}

      {promoCopy ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">推广文案</h3>
            <button
              type="button"
              onClick={onRegenerateCopy}
              disabled={loading}
              className="text-sm text-[#EB0EF5] underline-offset-2 hover:underline disabled:opacity-50 dark:text-[#f576f7]"
            >
              重新生成文案
            </button>
          </div>
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-medium text-zinc-950 dark:text-zinc-50">主标题：</span>
            {promoCopy.headline}
          </p>
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-medium text-zinc-950 dark:text-zinc-50">副标题：</span>
            {promoCopy.subheadline}
          </p>
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-medium text-zinc-950 dark:text-zinc-50">说明文字：</span>
            {promoCopy.description}
          </p>

          {!promoResult ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onConfirmGenerateBanner}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c90ad0] disabled:opacity-50"
              >
                <FourPointStarIcon className="size-[1.05rem] shrink-0 opacity-95" />
                生成推广图
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {promoResult ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">推广图</h3>
            <button
              type="button"
              onClick={onRegenerateBanner}
              disabled={loading}
              className="text-sm text-[#EB0EF5] underline-offset-2 hover:underline disabled:opacity-50 dark:text-[#f576f7]"
            >
              重新生成推广图
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={promoResult.imageUrl}
            alt="推广图"
            className="w-full max-w-4xl rounded-lg border border-zinc-100 dark:border-zinc-800"
          />
          <details className="rounded-lg border border-zinc-200 dark:border-zinc-700">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              生图 prompt
            </summary>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {promoResult.prompt}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
