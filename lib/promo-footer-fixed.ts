import { promises as fs } from "fs";
import path from "path";
import type { PromoFooterLocale } from "@/lib/promo-locale";

export type PromoFooterFixed = { lines: string[]; button: string };

const BUILTIN: Record<PromoFooterLocale, PromoFooterFixed> = {
  ja: {
    lines: [
      "①TikTok Lite をダウンロード",
      "②友だちを招待する→ポイントGET",
      "③クーポンと交換！",
    ],
    button: "無料ダウンロード",
  },
  ko: {
    lines: [
      "①TikTok Lite 설치",
      "②친구 초대 → 포인트 받기",
      "③쿠폰으로 교환!",
    ],
    button: "무료 설치",
  },
  en: {
    lines: [
      "①Download TikTok Lite",
      "②Invite friends → earn points",
      "③Redeem for coupons!",
    ],
    button: "Free download",
  },
  "pt-BR": {
    lines: [
      "①Baixe o TikTok Lite",
      "②Convide amigos → ganhe pontos",
      "③Troque por cupons!",
    ],
    button: "Baixar grátis",
  },
  es: {
    lines: [
      "①Descarga TikTok Lite",
      "②Invita amigos → gana puntos",
      "③¡Canjea cupones!",
    ],
    button: "Descargar gratis",
  },
  zh: {
    lines: ["①下载 TikTok Lite", "②邀请好友 → 得积分", "③兑换优惠券！"],
    button: "免费下载",
  },
};

const LOCALE_LABELS: Record<PromoFooterLocale, string> = {
  ja: "日语",
  ko: "韩语",
  en: "英语",
  "pt-BR": "巴西葡萄牙语",
  es: "西班牙语",
  zh: "中文",
};

/** 优先读 data 下文件，便于运营改词；ja 兼容历史文件名 jp */
const FOOTER_FILE_CANDIDATES: Record<PromoFooterLocale, string[]> = {
  ja: ["promo-footer-fixed-ja.txt", "promo-footer-fixed-jp.txt"],
  ko: ["promo-footer-fixed-ko.txt"],
  en: ["promo-footer-fixed-en.txt"],
  "pt-BR": ["promo-footer-fixed-pt-BR.txt"],
  es: ["promo-footer-fixed-es.txt"],
  zh: ["promo-footer-fixed-zh.txt"],
};

function parseFooterFile(raw: string): PromoFooterFixed {
  const lines: string[] = [];
  let button = "";
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const upper = t.toUpperCase();
    if (upper.startsWith("BUTTON:")) {
      button = t.slice(t.indexOf(":") + 1).trim();
      continue;
    }
    lines.push(t);
  }
  return { lines, button };
}

export async function loadPromoFooterFixed(locale: PromoFooterLocale): Promise<PromoFooterFixed> {
  const fallback = BUILTIN[locale];
  for (const name of FOOTER_FILE_CANDIDATES[locale]) {
    const filePath = path.join(process.cwd(), "data", name);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = parseFooterFile(raw);
      if (parsed.lines.length > 0) {
        return {
          lines: parsed.lines,
          button: parsed.button || fallback.button,
        };
      }
    } catch {
      /* 缺失则试下一个 */
    }
  }
  return { lines: [...fallback.lines], button: fallback.button };
}

export function formatFooterBlockForPrompt(
  footer: PromoFooterFixed,
  locale: PromoFooterLocale
): string {
  const lang = LOCALE_LABELS[locale];
  return [
    `【底部白块内必须逐字使用的固定文案（${lang}），须与上半部活动主标题/副标题/说明文为同一语言；禁止改成其它语言或改写成长篇活动口号】`,
    ...footer.lines,
    `【右侧胶囊按钮内固定为】${footer.button}`,
  ].join("\n");
}
