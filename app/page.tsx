"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DirectionPicker } from "@/components/DirectionPicker";
import { PromoFlow } from "@/components/PromoFlow";
import { ResultGallery } from "@/components/ResultGallery";
import { ThemeInput } from "@/components/ThemeInput";
import { UploadPanel } from "@/components/UploadPanel";
import { compressLayoutFile, compressIpRefFile, compressRefFile } from "@/lib/client-image";
import { parseApiJson } from "@/lib/parse-api-response";
import type { DirectionOption, GeneratedImageResult } from "@/lib/types";

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

type FileSlot = "layout" | "style" | "ip" | "coin";

export default function HomePage() {
  const [theme, setTheme] = useState("");
  const [options, setOptions] = useState<DirectionOption[]>([]);
  const [selected, setSelected] = useState<("A" | "B" | "C" | "D")[]>([]);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [coinFile, setCoinFile] = useState<File | null>(null);
  const [results, setResults] = useState<GeneratedImageResult[]>([]);
  const [promoSourceKey, setPromoSourceKey] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [promoCopy, setPromoCopy] = useState<PromoCopy | null>(null);
  const [promoResult, setPromoResult] = useState<PromoBanner | null>(null);
  const [promoVisible, setPromoVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFileChange = useCallback((slot: FileSlot, file: File | null) => {
    switch (slot) {
      case "layout":
        setLayoutFile(file);
        break;
      case "style":
        setStyleFile(file);
        break;
      case "ip":
        setIpFile(file);
        break;
      case "coin":
        setCoinFile(file);
        break;
    }
  }, []);

  async function handleGenerateDirections() {
    setLoading(true);
    try {
      const res = await fetch("/api/theme-directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = await parseApiJson<{ options: DirectionOption[]; error?: string }>(res);
      setOptions(data.options);
      setSelected([]);
      setResults([]);
      setPromoCopy(null);
      setPromoResult(null);
      setPromoVisible(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  async function buildKvBody() {
    return {
      theme,
      selectedOptions: selected,
      optionContents: options,
      images: {
        layoutBase64: layoutFile ? await compressLayoutFile(layoutFile) : undefined,
        styleBase64: styleFile ? await compressRefFile(styleFile) : undefined,
        ipBase64: ipFile ? await compressIpRefFile(ipFile) : undefined,
        coinBase64: coinFile ? await compressRefFile(coinFile) : undefined,
      },
    };
  }

  async function handleGenerateKv() {
    if (!layoutFile) {
      alert("请先上传图1（版式锁定参考）");
      return;
    }
    if (selected.length === 0) {
      alert("请至少选择一个方向");
      return;
    }

    setLoading(true);
    try {
      const body = await buildKvBody();
      const res = await fetch("/api/generate-kv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseApiJson<{
        results: GeneratedImageResult[];
        error?: string;
      }>(res);
      setResults(data.results);
      const firstKey = data.results[0]?.optionKey ?? null;
      setPromoSourceKey((prev) =>
        prev && data.results.some((r: GeneratedImageResult) => r.optionKey === prev) ? prev : firstKey
      );
      setPromoCopy(null);
      setPromoResult(null);
      setPromoVisible(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  function getPromoContext() {
    const key =
      promoSourceKey && results.some((r) => r.optionKey === promoSourceKey)
        ? promoSourceKey
        : results[0]?.optionKey;
    if (!key) return null;
    const visual = results.find((r) => r.optionKey === key);
    const opt = options.find((o) => o.key === key);
    if (!visual || !opt) return null;
    return { visual, opt };
  }

  /** 主视觉完成后：生成本地化推广文案；推广图需在下一步手动确认 */
  async function handleGeneratePromo() {
    const ctx = getPromoContext();
    if (!ctx) {
      alert("请先生成主视觉");
      return;
    }

    setLoading(true);
    setPromoVisible(true);
    try {
      const copyRes = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          selectedOptionKey: ctx.opt.key,
          selectedOptionContent: ctx.opt.content,
        }),
      });
      const copyData = await parseApiJson<PromoCopy & { error?: string }>(copyRes);
      setPromoCopy(copyData);
      setPromoResult(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmGenerateBanner() {
    const ctx = getPromoContext();
    if (!ctx || !promoCopy) {
      alert("请先生成推广文案");
      return;
    }

    setLoading(true);
    try {
      const bannerRes = await fetch("/api/generate-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          selectedOptionKey: ctx.opt.key,
          selectedOptionContent: ctx.opt.content,
          mainVisualUrl: ctx.visual.imageUrl,
          headline: promoCopy.headline,
          subheadline: promoCopy.subheadline,
          description: promoCopy.description,
        }),
      });
      const bannerData = await parseApiJson<PromoBanner & { error?: string }>(bannerRes);
      setPromoResult(bannerData);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerateCopy() {
    const ctx = getPromoContext();
    if (!ctx) return;

    setLoading(true);
    try {
      const copyRes = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          selectedOptionKey: ctx.opt.key,
          selectedOptionContent: ctx.opt.content,
        }),
      });
      const copyData = await parseApiJson<PromoCopy & { error?: string }>(copyRes);
      setPromoCopy(copyData);
      setPromoResult(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "错误");
    } finally {
      setLoading(false);
    }
  }

  /** 与「确认生成推广图」相同：重新跑 GPT prompt + Nanobanana（保留当前文案与主视觉） */
  async function handleRegenerateBanner() {
    await handleConfirmGenerateBanner();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            AI 主视觉 / 推广图生成器
          </h1>
          <Link
            href="/studio"
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            画布工作室（节点视图）
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          MVP：主题 → GPT 方向 → 参考图 + Nanobanana 主视觉 → 可选本地化文案与推广图。API Key 仅在后端使用。
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">处理中，请稍候（多方向将串行请求）…</p>
        ) : null}
      </header>

      <div className="space-y-10">
        <ThemeInput
          theme={theme}
          onThemeChange={setTheme}
          onGenerateDirections={handleGenerateDirections}
          loading={loading}
        />

        <DirectionPicker
          options={options}
          selected={selected}
          onToggle={(key, checked) => {
            if (checked) setSelected((prev) => [...new Set([...prev, key])]);
            else setSelected((prev) => prev.filter((k) => k !== key));
          }}
          onSelectAll={() => setSelected(["A", "B", "C", "D"])}
          onClear={() => setSelected([])}
        />

        <UploadPanel
          layoutFile={layoutFile}
          styleFile={styleFile}
          ipFile={ipFile}
          coinFile={coinFile}
          onFileChange={onFileChange}
          onGenerateKv={handleGenerateKv}
          loading={loading}
          canGenerate={selected.length > 0 && !!layoutFile}
        />

        <ResultGallery
          results={results}
          options={options}
          promoSourceKey={promoSourceKey}
          onPromoSourceKeyChange={(k) => setPromoSourceKey(k)}
          onRegenerateKv={handleGenerateKv}
          onContinuePromo={handleGeneratePromo}
          loading={loading}
        />

        <PromoFlow
          promoCopy={promoCopy}
          promoResult={promoResult}
          onRegenerateCopy={handleRegenerateCopy}
          onConfirmGenerateBanner={handleConfirmGenerateBanner}
          onRegenerateBanner={handleRegenerateBanner}
          loading={loading}
          visible={promoVisible}
        />
      </div>
    </main>
  );
}
