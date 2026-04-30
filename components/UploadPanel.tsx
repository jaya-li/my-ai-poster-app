"use client";

import { FourPointStarIcon } from "@/components/icons/FourPointStarIcon";

type FileSlot = "layout" | "style" | "ip" | "coin";

type Props = {
  layoutFile: File | null;
  styleFile: File | null;
  ipFile: File | null;
  coinFile: File | null;
  onFileChange: (slot: FileSlot, file: File | null) => void;
  onGenerateKv: () => void;
  loading: boolean;
  canGenerate: boolean;
  /** 为 true 时不展示图1上传（使用服务端内置版式） */
  hideLayoutSlot?: boolean;
};

const rows: { slot: FileSlot; label: string; required?: boolean }[] = [
  { slot: "layout", label: "图1 版式锁定参考", required: true },
  { slot: "style", label: "图2 风格参考" },
  { slot: "ip", label: "图3 IP 参考" },
  { slot: "coin", label: "图4 金币参考" },
];

function fileForSlot(
  slot: FileSlot,
  layoutFile: File | null,
  styleFile: File | null,
  ipFile: File | null,
  coinFile: File | null
) {
  switch (slot) {
    case "layout":
      return layoutFile;
    case "style":
      return styleFile;
    case "ip":
      return ipFile;
    case "coin":
      return coinFile;
  }
}

export function UploadPanel({
  layoutFile,
  styleFile,
  ipFile,
  coinFile,
  onFileChange,
  onGenerateKv,
  loading,
  canGenerate,
  hideLayoutSlot = false,
}: Props) {
  const visibleRows = hideLayoutSlot ? rows.filter((r) => r.slot !== "layout") : rows;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">3. 上传参考图</h2>
      <ul className="space-y-2 text-sm">
        {visibleRows.map(({ slot, label, required }) => (
          <li key={slot} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[10rem] text-zinc-600 dark:text-zinc-400">
              {label}
              {required ? <span className="text-red-500"> *</span> : null}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(slot, e.target.files?.[0] ?? null)}
              className="text-zinc-700 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 dark:text-zinc-300 dark:file:bg-zinc-700"
            />
            {fileForSlot(slot, layoutFile, styleFile, ipFile, coinFile) ? (
              <span className="text-xs text-zinc-500">
                {fileForSlot(slot, layoutFile, styleFile, ipFile, coinFile)!.name}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onGenerateKv}
        disabled={loading || !canGenerate}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EB0EF5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c90ad0] disabled:opacity-50"
      >
        <FourPointStarIcon className="size-[1.05rem] shrink-0 opacity-95" />
        生成主视觉
      </button>
    </section>
  );
}
