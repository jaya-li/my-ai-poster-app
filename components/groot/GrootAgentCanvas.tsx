"use client";

import Link from "next/link";
import { useState } from "react";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="4" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 17h6M10 14v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const dotCanvasBg =
  "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[length:20px_20px]";

const todos = [
  { title: "需求明确", desc: "：为巴西父亲节设计推广图，目标是突出节日氛围和亲情感" },
  { title: "定义主视觉", desc: "：确定以家庭、温情或节日符号为核心的视觉方向" },
  { title: "图片编辑", desc: "：基于主视觉生成和优化设计图" },
  { title: "审核检验", desc: "：检查是否符合节日文化和推广需求" },
];

const directions = [
  {
    n: 1,
    title: "方向一 温馨陪伴：",
    body: "父亲和孩子一起画画，画面以热带雨林色彩为灵感，主色调是明亮的黄色",
  },
  {
    n: 2,
    title: "方向二 自然探险：",
    body: "父亲带孩子在森林中探险，背景有芭蕉叶和巨嘴鸟，氛围轻松又充满探索",
  },
  {
    n: 3,
    title: "方向三 海边时光：",
    body: "父亲和孩子在落日余晖下的海滩玩耍，整体呈现温暖的夕阳氛围",
  },
  {
    n: 4,
    title: "方向四 节日惊喜：",
    body: "孩子为父亲送上礼物，父亲拆礼物的瞬间充满家庭的温馨与感动",
  },
];

export function GrootAgentCanvas() {
  const [draft, setDraft] = useState("我要为巴西父亲节做一张");

  return (
    <div className="min-h-screen bg-zinc-950 p-3 text-zinc-100 sm:p-4">
      <div
        className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[rgba(28,31,35,0.12)] shadow-2xl sm:h-[calc(100vh-2rem)]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgb(28,28,28) 46%), linear-gradient(90deg, rgb(53,53,53) 0%, rgb(53,53,53) 100%)",
        }}
      >
        {/* Top bar — 对齐 Figma 3012:2627 */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="size-7 shrink-0 rounded-[9px] bg-zinc-100" aria-hidden />
            <div className="hidden h-5 w-px bg-white/15 sm:block" />
            <button
              type="button"
              className="hidden rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 sm:block"
              aria-label="侧栏"
            >
              <span className="block size-5 border border-white/30" />
            </button>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-3 text-center sm:gap-4">
            <h1 className="truncate text-sm font-semibold text-[#f0f0f0] sm:text-[14px]">
              ASO - 巴西父亲节
            </h1>
            <div className="hidden h-5 w-px bg-white/15 sm:block" />
            <p className="hidden truncate text-[13px] text-white/40 sm:block">{`@刘一一 创建  `}</p>
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] text-[#f0f0f0] hover:bg-white/5"
          >
            <MonitorIcon className="size-5 text-zinc-300" />
            <span className="hidden sm:inline">展开画布</span>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* 主画布 */}
          <div className={`min-h-0 flex-1 overflow-y-auto ${dotCanvasBg}`}>
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8 pb-40 lg:pb-28">
              <p
                data-node-id="3012:2632"
                className="rounded-[32px] border-[3px] border-white/12 bg-[rgba(235,14,245,0.18)] px-8 py-5 text-center text-xs leading-4 text-white sm:text-[12px]"
              >
                我要为巴西父亲节做一张推广图
              </p>

              <div className="h-8 w-px bg-white/20" aria-hidden />

              {/* To-dos 卡片 */}
              <section
                data-name="TodosCrad"
                className="w-full max-w-[400px] space-y-4 rounded-[32px] bg-[#26292b] p-8 shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-white/40">
                    <ListArrowIcon className="size-5" />
                    <span className="text-sm font-semibold leading-[17px]">To-dos</span>
                  </div>
                  <span className="text-sm font-semibold leading-[17px] text-white/40">1 of 4</span>
                </div>
                {todos.map((item) => (
                  <div key={item.title} className="flex gap-2">
                    <div
                      className="mt-0.5 size-[15px] shrink-0 rounded-full border-[1.5px] border-white/30"
                      aria-hidden
                    />
                    <p className="min-w-0 text-sm leading-[17px] text-white">
                      <span className="font-semibold">{item.title}</span>
                      <span className="font-normal">{item.desc}</span>
                    </p>
                  </div>
                ))}
              </section>

              <div className="h-10 w-px bg-white/20" aria-hidden />

              {/* 四方向 */}
              <div className="grid w-full max-w-[1100px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {directions.map((d) => (
                  <article
                    key={d.n}
                    className="flex min-h-[130px] gap-2 rounded-[32px] bg-[#26292b] py-5 pl-5 pr-3 shadow-md ring-1 ring-white/[0.08]"
                  >
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-center text-xs font-semibold leading-none text-black">
                      {d.n}
                    </div>
                    <div className="min-w-0 text-[13px] leading-normal text-[#f0f0f0]">
                      <p className="mb-1 font-semibold text-[#f0f0f0]">{d.title}</p>
                      <p className="text-white/90">{d.body}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="h-6 w-px bg-white/20" aria-hidden />

              <p className="rounded-[32px] border-[3px] border-white/12 bg-[rgba(235,14,245,0.18)] px-8 py-5 text-xs text-white sm:text-[12px]">
                方向一：温馨陪伴
              </p>

              <div className="w-full max-w-[720px] rounded-[32px] bg-[#26292b] px-8 py-5 text-[12px] leading-[17px] text-[#f0f0f0] shadow-lg">
                <p>
                  <span>好的，以下是我基于方向一 </span>
                  <span className="font-semibold">温馨陪伴 </span>
                  <span>
                    为你生成的视觉图：
                    <br />
                    选择你满意的，我们可以基于它继续深化和优化，如果不满意的话，我们可以重新生成一组。
                  </span>
                </p>
              </div>

              {/* 成图预览行 — 占位图块 */}
              <div className="grid w-full max-w-[900px] grid-cols-2 gap-4 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <div
                      className="aspect-[120/67] w-full rounded-[10px] bg-gradient-to-br from-zinc-600 to-zinc-800 ring-1 ring-white/10"
                      aria-hidden
                    />
                    {i === 1 ? (
                      <div className="flex flex-wrap gap-2 text-[7px] font-medium sm:text-[10px]">
                        {["预览", "下载", "引用", "收藏"].map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-1 text-white/90"
                          >
                            {label === "预览" ? (
                              <MonitorIcon className="size-3 text-white/80" />
                            ) : null}
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="rounded-[32px] border-[3px] border-white/12 bg-[rgba(235,14,245,0.18)] p-8 text-sm text-white">
                <div className="mb-4 flex aspect-[90/50] max-w-[90px] items-center justify-center rounded-[10px] bg-zinc-700/80 ring-1 ring-white/20" />
                <p className="max-w-[200px] text-sm leading-4">已明确图片，帮我生成预览界面</p>
              </div>
            </div>
          </div>

          {/* 右侧 Mock 简版 — 对应 Figma 设备预览区概貌 */}
          <aside className="hidden w-[248px] shrink-0 flex-col gap-3 border-l border-white/5 bg-black/20 p-3 lg:flex">
            <div className="flex items-center justify-between rounded-3xl bg-[#26292b] px-3 py-2 text-[11px] text-white/60">
              <span>Android 360×800</span>
              <span className="text-white/40">|</span>
              <span>US</span>
              <ChevronDownIcon className="size-3" />
            </div>
            <div className="relative flex flex-1 items-center justify-center rounded-[48px] border border-white/10 bg-gradient-to-b from-[#eee8e1] to-[#dfdad0] p-2 shadow-inner">
              <div className="flex h-full min-h-[420px] w-full max-w-[200px] flex-col overflow-hidden rounded-[40px] bg-black ring-2 ring-zinc-700">
                <div className="flex h-6 items-center justify-between px-3 pt-2 text-[8px] text-white">
                  <span>8:00</span>
                  <span className="text-white/60">▮▮▮</span>
                </div>
                <div className="flex-1 overflow-hidden bg-white p-2">
                  <p className="text-[9px] font-medium text-zinc-900">TikTok Lite - Faster TikTok</p>
                  <p className="text-[8px] text-zinc-500">TikTok Pte. Ltd.</p>
                  <div
                    className="mt-3 aspect-[9/16] w-full rounded-lg bg-zinc-200"
                    aria-label="商店详情预览占位"
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* 底部输入 — Dev Mode / 截图中的 composer 结构 */}
        <footer className="shrink-0 border-t border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 shadow-xl">
              <label className="sr-only" htmlFor="groot-input">
                输入指令
              </label>
              <textarea
                id="groot-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                placeholder="我要为巴西父亲节做一张…"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                    title="上传图片"
                  >
                    🖼
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                  >
                    Midjourney
                    <ChevronDownIcon className="size-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-white/15 px-2 py-1 text-xs tabular-nums text-zinc-300">
                    4
                  </span>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full bg-[#EB0EF5] text-white hover:bg-[#c90ad0]"
                    aria-label="发送"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {["文本", "素材", "图形"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-2 flex max-w-3xl justify-center gap-4 text-[11px] text-zinc-500">
            <Link href="/studio" className="hover:text-zinc-300">
              工作室画布（节点编辑）
            </Link>
            <Link href="/" className="hover:text-zinc-300">
              标准流程
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
