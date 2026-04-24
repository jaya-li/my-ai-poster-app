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
  onConfirmGenerateBanner: () => void;
  onRegenerateBanner: () => void;
  loading: boolean;
  visible: boolean;
};

export function PromoFlow({
  promoCopy,
  promoResult,
  onRegenerateCopy,
  onConfirmGenerateBanner,
  onRegenerateBanner,
  loading,
  visible,
}: Props) {
  if (!visible) return null;

  return (
    <section className="space-y-6 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">5. 推广文案与推广图</h2>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        推广图使用<strong>内置构图参考</strong>（<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">public/promo-layout-ref.png</code>
        ）与主视觉。下方白块①②③与下载按钮会随<strong>推广文案语言</strong>自动切换（日/韩/英/巴葡/西/中等），模板来自内置文案或{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">data/promo-footer-fixed-*.txt</code>
        ；日语仍可读 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">promo-footer-fixed-jp.txt</code>
        。版式与图2一致，白块内文字语言以模板为准（可与参考图上的示例字不同）。尺寸 2560×1344。
      </p>

      {promoCopy ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">推广文案</h3>
            <button
              type="button"
              onClick={onRegenerateCopy}
              disabled={loading}
              className="text-sm text-violet-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-violet-400"
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
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-violet-600"
              >
                确认生成推广图（GPT 写 prompt + Nanobanana 出图）
              </button>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                确认后将使用当前文案、主视觉与内置构图参考生图；耗时可能较长。
              </p>
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
              className="text-sm text-violet-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-violet-400"
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
