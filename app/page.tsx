"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FlowNotice } from "@/components/FlowNotice";
import { DirectionPicker } from "@/components/DirectionPicker";
import { PromoFlow } from "@/components/PromoFlow";
import { ResultGallery } from "@/components/ResultGallery";
import { ThemeInput } from "@/components/ThemeInput";
import { UploadPanel } from "@/components/UploadPanel";
import { compressLayoutFile, compressIpRefFile, compressRefFile } from "@/lib/client-image";
import { parseApiJson } from "@/lib/parse-api-response";
import type { ChongbangKvSpec, StarCollectKvSpec, WheelKvSpec } from "@/lib/prompts";
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

type LoadingPhase = null | "directions" | "kv" | "copy" | "banner";

export default function HomePage() {
  const [theme, setTheme] = useState("");
  const [options, setOptions] = useState<DirectionOption[]>([]);
  const [selected, setSelected] = useState<("A" | "B" | "C" | "D")[]>([]);
  const [useBuiltinLayout, setUseBuiltinLayout] = useState(false);
  const [kvCampaignType, setKvCampaignType] = useState<
    "scan" | "chongbang" | "star_collect" | "wheel" | "baiyuan"
  >("scan");
  const [chongbangSpecForm, setChongbangSpecForm] = useState({
    targetLanguage: "",
    scene: "",
    rewardItems: "",
    decorativeElements: "",
    primaryColor: "",
    mascotBrief: "",
    coinVariation: "",
    moodKeywords: "",
  });
  const [starCollectSpecForm, setStarCollectSpecForm] = useState({
    targetLanguage: "",
    collectible: "",
    container: "",
    scene: "",
    decorativeElements: "",
    primaryColor: "",
    ipBrief: "",
    coinVariation: "",
    moodKeywords: "",
  });
  const [wheelSpecForm, setWheelSpecForm] = useState({
    targetLanguage: "",
    scene: "",
    prizeElements: "",
    decorativeElements: "",
    primaryColor: "",
    ipBrief: "",
    coinVariation: "",
    moodKeywords: "",
  });
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [coinFile, setCoinFile] = useState<File | null>(null);
  const [results, setResults] = useState<GeneratedImageResult[]>([]);
  const [promoSourceKey, setPromoSourceKey] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [promoCopy, setPromoCopy] = useState<PromoCopy | null>(null);
  const [promoResult, setPromoResult] = useState<PromoBanner | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(null);
  const [flowNotice, setFlowNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const loading = loadingPhase !== null;

  const loadingLine =
    loadingPhase === "directions"
      ? "生成方向中…"
      : loadingPhase === "kv"
        ? "生成主视觉中…"
        : loadingPhase === "copy"
          ? "生成推广文案中…"
          : loadingPhase === "banner"
            ? "生成推广图中…"
            : null;

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
    setLoadingPhase("directions");
    setFlowNotice(null);
    try {
      const res = await fetch("/api/theme-directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, campaignType: kvCampaignType }),
      });
      const data = await parseApiJson<{ options: DirectionOption[]; error?: string }>(res);
      setOptions(data.options);
      setSelected([]);
      setResults([]);
      setPromoCopy(null);
      setPromoResult(null);
    } catch (e: unknown) {
      setFlowNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "生成方向失败，请稍后重试。",
      });
    } finally {
      setLoadingPhase(null);
    }
  }

  async function buildKvBody() {
    const chongbangOut: ChongbangKvSpec = {};
    (Object.keys(chongbangSpecForm) as (keyof typeof chongbangSpecForm)[]).forEach((k) => {
      const v = chongbangSpecForm[k].trim();
      if (v) chongbangOut[k] = v;
    });
    const hasChongbangSpec = Object.keys(chongbangOut).length > 0;

    const starOut: StarCollectKvSpec = {};
    (Object.keys(starCollectSpecForm) as (keyof typeof starCollectSpecForm)[]).forEach((k) => {
      const v = starCollectSpecForm[k].trim();
      if (v) starOut[k] = v;
    });
    const hasStarSpec = Object.keys(starOut).length > 0;

    const wheelOut: WheelKvSpec = {};
    (Object.keys(wheelSpecForm) as (keyof typeof wheelSpecForm)[]).forEach((k) => {
      const v = wheelSpecForm[k].trim();
      if (v) wheelOut[k] = v;
    });
    const hasWheelSpec = Object.keys(wheelOut).length > 0;

    return {
      theme,
      selectedOptions: selected,
      optionContents: options,
      campaignType: kvCampaignType,
      ...(kvCampaignType === "chongbang" && hasChongbangSpec ? { chongbangSpec: chongbangOut } : {}),
      ...(kvCampaignType === "star_collect" && hasStarSpec ? { starCollectSpec: starOut } : {}),
      ...(kvCampaignType === "wheel" && hasWheelSpec ? { wheelSpec: wheelOut } : {}),
      images: {
        ...(useBuiltinLayout
          ? {}
          : {
              layoutBase64: layoutFile ? await compressLayoutFile(layoutFile) : undefined,
            }),
        styleBase64: styleFile ? await compressRefFile(styleFile) : undefined,
        ipBase64: ipFile ? await compressIpRefFile(ipFile) : undefined,
        coinBase64: coinFile ? await compressRefFile(coinFile) : undefined,
      },
    };
  }

  async function handleGenerateKv() {
    if (!useBuiltinLayout && !layoutFile) {
      setFlowNotice({
        kind: "info",
        text: "请先上传图1 版式参考，或勾选「内置版式」以使用服务器随机母版。",
      });
      return;
    }
    if (selected.length === 0) {
      setFlowNotice({
        kind: "info",
        text: "请先在第 2 步至少勾选一个方向，再生成主视觉。",
      });
      return;
    }

    setLoadingPhase("kv");
    setFlowNotice(null);
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
    } catch (e: unknown) {
      setFlowNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "主视觉生成失败，请稍后重试。",
      });
    } finally {
      setLoadingPhase(null);
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
      setFlowNotice({
        kind: "info",
        text: "请先生成主视觉，并确保在结果区选定的方案与上方勾选一致。",
      });
      return;
    }

    setLoadingPhase("copy");
    setFlowNotice(null);
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
      setFlowNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "推广文案生成失败，请稍后重试。",
      });
    } finally {
      setLoadingPhase(null);
    }
  }

  async function handleConfirmGenerateBanner() {
    const ctx = getPromoContext();
    if (!ctx || !promoCopy) {
      setFlowNotice({
        kind: "info",
        text: "请先生成推广文案，再确认生成推广图。",
      });
      return;
    }

    setLoadingPhase("banner");
    setFlowNotice(null);
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
      setFlowNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "推广图生成失败，请稍后重试。",
      });
    } finally {
      setLoadingPhase(null);
    }
  }

  async function handleRegenerateCopy() {
    const ctx = getPromoContext();
    if (!ctx) return;

    setLoadingPhase("copy");
    setFlowNotice(null);
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
      setFlowNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "推广文案生成失败，请稍后重试。",
      });
    } finally {
      setLoadingPhase(null);
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
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/groot-agent"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Groot Agent（Figma 主页）
            </Link>
            <Link
              href="/studio"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              画布工作室（节点视图）
            </Link>
          </div>
        </div>
        {flowNotice ? (
          <div className="mt-3">
            <FlowNotice
              kind={flowNotice.kind}
              message={flowNotice.text}
              onDismiss={() => setFlowNotice(null)}
            />
          </div>
        ) : null}
        {loadingLine ? (
          <p className="mt-3 text-sm text-[#EB0EF5] dark:text-[#f576f7]">{loadingLine}</p>
        ) : null}
      </header>

      <div className="space-y-10">
        <ThemeInput
          theme={theme}
          onThemeChange={(v) => {
            setTheme(v);
            setFlowNotice(null);
          }}
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

        <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">主视觉版式</h2>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={useBuiltinLayout}
              onChange={(e) => setUseBuiltinLayout(e.target.checked)}
              className="mt-1"
            />
            <span>
              使用<strong className="font-medium text-zinc-900 dark:text-zinc-100">内置版式</strong>
              （无需上传图1；各玩法从对应母版池中随机选 1 张；单次请求内多方向共用同一张）
            </span>
          </label>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="text-zinc-500 dark:text-zinc-400">玩法：</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="kv-campaign"
                checked={kvCampaignType === "scan"}
                onChange={() => setKvCampaignType("scan")}
              />
              扫码活动
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="kv-campaign"
                checked={kvCampaignType === "chongbang"}
                onChange={() => setKvCampaignType("chongbang")}
              />
              冲榜活动
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="kv-campaign"
                checked={kvCampaignType === "star_collect"}
                onChange={() => setKvCampaignType("star_collect")}
              />
              星星收集
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="kv-campaign"
                checked={kvCampaignType === "wheel"}
                onChange={() => setKvCampaignType("wheel")}
              />
              转盘
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="kv-campaign"
                checked={kvCampaignType === "baiyuan"}
                onChange={() => setKvCampaignType("baiyuan")}
              />
              百元
            </label>
          </div>
          {kvCampaignType === "chongbang" ? (
            <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900/50">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                冲榜主题参数（可选，写入生图 PE）
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["targetLanguage", "目标语言"],
                    ["scene", "场景"],
                    ["rewardItems", "奖励物"],
                    ["decorativeElements", "装饰元素"],
                    ["primaryColor", "主色调"],
                    ["mascotBrief", "吉祥物设定"],
                    ["coinVariation", "金币变化方向"],
                    ["moodKeywords", "气质关键词"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs text-zinc-600 dark:text-zinc-400">
                    {label}
                    <input
                      type="text"
                      value={chongbangSpecForm[key]}
                      onChange={(e) =>
                        setChongbangSpecForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                ))}
              </div>
            </details>
          ) : null}
          {kvCampaignType === "star_collect" ? (
            <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900/50">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                星星收集参数（可选，写入生图 PE）
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["targetLanguage", "目标语言"],
                    ["collectible", "收集物"],
                    ["container", "容器"],
                    ["scene", "场景"],
                    ["decorativeElements", "装饰元素"],
                    ["primaryColor", "主色调"],
                    ["ipBrief", "IP设定"],
                    ["coinVariation", "金币变化方向"],
                    ["moodKeywords", "关键词"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs text-zinc-600 dark:text-zinc-400">
                    {label}
                    <input
                      type="text"
                      value={starCollectSpecForm[key]}
                      onChange={(e) =>
                        setStarCollectSpecForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                ))}
              </div>
            </details>
          ) : null}
          {kvCampaignType === "wheel" ? (
            <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900/50">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                转盘抽奖参数（可选，写入生图 PE）
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["targetLanguage", "目标语言"],
                    ["scene", "场景"],
                    ["prizeElements", "奖品元素"],
                    ["decorativeElements", "装饰元素"],
                    ["primaryColor", "主色调"],
                    ["ipBrief", "IP设定"],
                    ["coinVariation", "金币变化方向"],
                    ["moodKeywords", "关键词"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs text-zinc-600 dark:text-zinc-400">
                    {label}
                    <input
                      type="text"
                      value={wheelSpecForm[key]}
                      onChange={(e) =>
                        setWheelSpecForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <UploadPanel
          layoutFile={layoutFile}
          styleFile={styleFile}
          ipFile={ipFile}
          coinFile={coinFile}
          onFileChange={onFileChange}
          onGenerateKv={handleGenerateKv}
          loading={loading}
          canGenerate={selected.length > 0 && (useBuiltinLayout || !!layoutFile)}
          hideLayoutSlot={useBuiltinLayout}
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
          hasMainVisual={results.length > 0}
          onStartPromo={handleGeneratePromo}
        />
      </div>
    </main>
  );
}
