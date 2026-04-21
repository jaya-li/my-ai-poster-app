"use client";

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
  onRegenerateBanner: () => void;
  loading: boolean;
  visible: boolean;
};

export function PromoFlow({
  promoCopy,
  promoResult,
  onRegenerateCopy,
  onRegenerateBanner,
  loading,
  visible,
}: Props) {
  if (!visible) return null;

  return (
    <section className="space-y-6 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">5. 推广文案与推广图</h2>

      {promoCopy ? (
        <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">日文文案</h3>
            <button
              type="button"
              onClick={onRegenerateCopy}
              disabled={loading}
              className="text-sm text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
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
              className="text-sm text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
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
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {promoResult.prompt}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
