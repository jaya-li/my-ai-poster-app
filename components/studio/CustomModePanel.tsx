"use client";

/**
 * 自定义模式右侧浮动面板：
 *
 *   阶段 1（input）：用户填写想法 / 选择玩法 / 上传 0~4 张参考图，点击「生成 prompt」。
 *   阶段 2（pe-ready）：展示 GPT 拼好的 nano 可执行 prompt，用户可整段编辑，点击「生成图片」走 nano。
 *
 * 该组件本身是「受控」组件：所有表单状态都由父级 StudioCanvas 持有，
 * 因此在 Agent ⇄ 自定义 Tab 切换时不会丢任何已填字段或已选文件（父级只是把 visible 切到 false，
 * 子树仍挂载在 DOM 中，依赖 CSS hidden 隐藏；textarea 光标也得以保留）。
 *
 * 用户成功生成一张主视觉后，父级会把结果写入一个新 thread，同时把本面板的 phase 复位为 'input'
 * 以方便用户「重新开新一轮自定义生成」，但 idea/campaign/4 files 等字段会原样保留，便于微调再生。
 */
import type { ChangeEvent } from "react";
import { FlowNotice } from "@/components/FlowNotice";
import type { KvCampaignType } from "@/lib/kv-layout-builtin";

export type CustomModePhase = "input" | "pe-ready";

type Props = {
  visible: boolean;
  /** 'input' = 编 idea + 参考图；'pe-ready' = 编 GPT 给的 prompt */
  phase: CustomModePhase;
  /** 用户的「想法」原文，将作为 theme + selectedOptionText 一并喂给 PE */
  idea: string;
  onIdeaChange: (v: string) => void;
  /** 选定玩法 */
  campaignType: KvCampaignType;
  onCampaignTypeChange: (v: KvCampaignType) => void;
  /** 4 张可选参考图；layout=图1（不上传则后端从内置随机抽 1 张）*/
  layoutFile: File | null;
  styleFile: File | null;
  ipFile: File | null;
  coinFile: File | null;
  onFileChange: (slot: "layout" | "style" | "ip" | "coin", file: File | null) => void;
  /** GPT 返回、用户可整段重写的最终 nano prompt */
  draftedPrompt: string;
  onDraftedPromptChange: (v: string) => void;
  /** PE 阶段产出的额外信息（仅用于显示，并不影响出图——后端拿 prompt 即可） */
  peKvLayoutTemplate?: string;
  notice: { kind: "error" | "info"; text: string } | null;
  onDismissNotice: () => void;
  loading: boolean;
  busyHint: string;
  /** 阶段 1 提交 */
  onSubmitPe: () => void;
  /** 阶段 2 提交 */
  onSubmitImage: () => void;
  /** 回到阶段 1（保留 PE 草稿，便于来回切） */
  onBackToInput: () => void;
};

const FILE_SLOTS: Array<{
  slot: "layout" | "style" | "ip" | "coin";
  label: string;
  hint: string;
}> = [
  {
    slot: "layout",
    label: "图1 版式（可选，不传走内置随机）",
    hint: "用户上传则锁为唯一母版；不传则按玩法从 public/ 内置版式中随机抽 1 张作为图 1。",
  },
  { slot: "style", label: "图2 风格（可选）", hint: "整页画风、色相、材质画法的强约束。" },
  { slot: "ip", label: "图3 IP（可选）", hint: "主角色还原的强约束；未传则不生成 IP 锚点。" },
  { slot: "coin", label: "图4 金币（可选）", hint: "金币/代币材质参考。" },
];

const CAMPAIGN_OPTIONS: ReadonlyArray<readonly [KvCampaignType, string]> = [
  ["scan", "扫码"],
  ["chongbang", "冲榜"],
  ["star_collect", "星星收集"],
  ["wheel", "转盘"],
  ["tuijinbi", "推金币"],
  ["baiyuan", "百元"],
];

function fileLabel(file: File | null): string {
  if (!file) return "未选";
  const name = file.name.length > 28 ? `${file.name.slice(0, 25)}…` : file.name;
  return `${name}（${(file.size / 1024).toFixed(0)} KB）`;
}

export function CustomModePanel(props: Props) {
  const {
    visible,
    phase,
    idea,
    onIdeaChange,
    campaignType,
    onCampaignTypeChange,
    layoutFile,
    styleFile,
    ipFile,
    coinFile,
    onFileChange,
    draftedPrompt,
    onDraftedPromptChange,
    peKvLayoutTemplate,
    notice,
    onDismissNotice,
    loading,
    busyHint,
    onSubmitPe,
    onSubmitImage,
    onBackToInput,
  } = props;

  const files: Record<"layout" | "style" | "ip" | "coin", File | null> = {
    layout: layoutFile,
    style: styleFile,
    ip: ipFile,
    coin: coinFile,
  };

  const handleFile =
    (slot: "layout" | "style" | "ip" | "coin") => (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      onFileChange(slot, f);
      e.target.value = ""; // 允许同名再选
    };

  return (
    <div
      className={`fixed right-6 top-[7.5rem] z-[10038] max-h-[calc(100vh-9rem)] w-[min(92vw,26rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-[#26292b]/98 px-3.5 py-3 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] backdrop-blur-md sm:w-[28rem] ${
        visible ? "" : "pointer-events-none invisible opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide text-white/80">
          自定义生成 · {phase === "input" ? "想法 → PE" : "校对 PE → 生图"}
        </div>
        {busyHint ? (
          <div className="text-[11px] text-white/55">{busyHint}</div>
        ) : null}
      </div>

      {notice ? (
        <div className="mb-2">
          <FlowNotice kind={notice.kind} message={notice.text} onDismiss={onDismissNotice} />
        </div>
      ) : null}

      {phase === "input" ? (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium tracking-wide text-white/45">
              想法 / 主题 / 主视觉方向（必填）
            </span>
            <textarea
              value={idea}
              onChange={(e) => onIdeaChange(e.target.value)}
              rows={5}
              placeholder="例如：巴西世界杯主题推金币，桑巴狂欢氛围，金币改造为足球，奖格内放球星头像和奖杯，IP 用我们家的橘猫吉祥物，整体强对比暖橙+亮绿…"
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#EB0EF5] focus:outline-none"
            />
          </label>

          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-white/45">玩法</p>
            <div
              className="flex flex-wrap gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]"
              role="radiogroup"
              aria-label="自定义模式 KV 玩法"
            >
              {CAMPAIGN_OPTIONS.map(([value, label]) => {
                const selected = campaignType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      selected
                        ? "bg-[#EB0EF5] text-white shadow-sm"
                        : "text-white/55 hover:bg-white/10 hover:text-white/85"
                    }`}
                    onClick={() => onCampaignTypeChange(value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-white/45">
              参考图（均可选）
            </p>
            <div className="space-y-2">
              {FILE_SLOTS.map(({ slot, label, hint }) => {
                const f = files[slot];
                return (
                  <div
                    key={slot}
                    className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-200">{label}</div>
                        <div className="mt-0.5 text-[10.5px] leading-tight text-zinc-500">
                          {hint}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <label className="cursor-pointer rounded-md border border-zinc-600 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/5">
                          {f ? "更换" : "选择"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFile(slot)}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-zinc-500">
                      <span className="truncate">{fileLabel(f)}</span>
                      {f ? (
                        <button
                          type="button"
                          className="shrink-0 text-zinc-400 hover:text-rose-300"
                          onClick={() => onFileChange(slot, null)}
                        >
                          移除
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={loading || idea.trim().length === 0}
            onClick={onSubmitPe}
            className="w-full rounded-lg bg-[#EB0EF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#d40bdc] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {loading ? "GPT 拼接中…" : "生成 prompt"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {peKvLayoutTemplate ? (
            <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-2.5 py-1.5 text-[10.5px] text-zinc-400">
              本次将使用内置版式：<code className="text-zinc-200">{peKvLayoutTemplate}</code>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-2.5 py-1.5 text-[10.5px] text-zinc-400">
              本次将使用你上传的版式图作为图 1。
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium tracking-wide text-white/45">
              GPT 拼接的 nano prompt（可整段编辑，最终交给 nanobanana）
            </span>
            <textarea
              value={draftedPrompt}
              onChange={(e) => onDraftedPromptChange(e.target.value)}
              rows={16}
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-[#EB0EF5] focus:outline-none"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onBackToInput}
              className="flex-1 rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              回到上一步
            </button>
            <button
              type="button"
              disabled={loading || draftedPrompt.trim().length === 0}
              onClick={onSubmitImage}
              className="flex-[2] rounded-lg bg-[#EB0EF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#d40bdc] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {loading ? "nanobanana 出图中…" : "生成图片"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
