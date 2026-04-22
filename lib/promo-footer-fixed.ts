import { promises as fs } from "fs";
import path from "path";

const DEFAULT_LINES = [
  "①TikTok Lite をダウンロード",
  "②友だちを招待する→ポイントGET",
  "③クーポンと交換！",
];
const DEFAULT_BUTTON = "無料ダウンロード";

/** 底部白块①②③ + 按钮文案：与版式参考图2 锁定，不随活动 GPT 文案变化 */
export async function loadPromoFooterFixedJp(): Promise<{
  lines: string[];
  button: string;
}> {
  const filePath = path.join(process.cwd(), "data", "promo-footer-fixed-jp.txt");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines: string[] = [];
    let button = DEFAULT_BUTTON;
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const upper = t.toUpperCase();
      if (upper.startsWith("BUTTON:")) {
        button = t.slice(t.indexOf(":") + 1).trim() || DEFAULT_BUTTON;
        continue;
      }
      lines.push(t);
    }
    if (lines.length > 0) {
      return { lines, button };
    }
  } catch {
    /* 文件缺失时用默认 */
  }
  return { lines: [...DEFAULT_LINES], button: DEFAULT_BUTTON };
}

export function formatFooterBlockForPrompt(footer: {
  lines: string[];
  button: string;
}): string {
  return [
    "【底部白块内必须逐字使用的固定日文，禁止改成活动说明或其它主题句】",
    ...footer.lines,
    `【右侧胶囊按钮内固定为】${footer.button}`,
  ].join("\n");
}
