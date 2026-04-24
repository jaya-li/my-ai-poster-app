export const PROMO_FOOTER_LOCALES = ["ja", "ko", "en", "pt-BR", "es", "zh"] as const;
export type PromoFooterLocale = (typeof PROMO_FOOTER_LOCALES)[number];

/**
 * 根据已生成的上半部文案 + 主题推断底部固定条应使用的语言（与 COPYWRITING_SYSTEM 市场判定对齐）。
 */
export function inferPromoFooterLocale(input: {
  headline: string;
  subheadline: string;
  description: string;
  theme: string;
}): PromoFooterLocale {
  const s = `${input.headline}\n${input.subheadline}\n${input.description}\n${input.theme}`.trim();

  if (/[\uAC00-\uD7A3]/.test(s)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(s)) return "ja";

  const lower = s.toLowerCase();
  if (
    /[ãõâêô]/.test(lower) ||
    /\b(você|voce|também|tambem|não|nao|grátis|gratis|escaneie|decisão|decisao)\b/i.test(lower) ||
    /\bcupons\b/i.test(s)
  ) {
    return "pt-BR";
  }
  if (/[¿¡ñ]/.test(s) || /\bcupones\b/i.test(s) || /\bcupón\b/i.test(s)) {
    return "es";
  }
  if (/[\u4E00-\u9FFF]/.test(s)) return "zh";

  if (
    /\b(baixe|baixar|amigos|para ganhar|participe|vantagens)\b/i.test(s) &&
    !/\b(download|friends|earn points|scan the)\b/i.test(lower)
  ) {
    return "pt-BR";
  }
  if (/\b(descarga|invita|invitar|escanea|gana puntos)\b/i.test(lower)) {
    return "es";
  }

  return "en";
}
