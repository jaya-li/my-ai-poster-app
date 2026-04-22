import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadBuiltinBannerLayoutRef } from "@/lib/banner-layout";
import {
  formatFooterBlockForPrompt,
  loadPromoFooterFixedJp,
} from "@/lib/promo-footer-fixed";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import { BANNER_PROMPT_SYSTEM } from "@/lib/prompts";
import { inputText, inputImage } from "@/lib/response-content";
import { urlToNanoReference } from "@/lib/url-to-reference";

export const runtime = "nodejs";

const BodySchema = z.object({
  theme: z.string().min(1),
  selectedOptionKey: z.enum(["A", "B", "C", "D"]),
  selectedOptionContent: z.string().min(1),
  mainVisualUrl: z.string().min(1),
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  description: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "缺少 OPENAI_API_KEY（请在项目根目录 .env.local 中填写）" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = BodySchema.parse(body);

    const layoutRef = await loadBuiltinBannerLayoutRef();
    const layoutDataUri = `data:${layoutRef.mimeType};base64,${layoutRef.base64}`;
    const footerFixed = await loadPromoFooterFixedJp();
    const footerPromptBlock = formatFooterBlockForPrompt(footerFixed);

    const response = await openai.responses.create({
      model: getOpenAIModel(),
      input: [
        {
          role: "system",
          content: [inputText(BANNER_PROMPT_SYSTEM)],
        },
        {
          role: "user",
          content: [
            inputText(
              `当前主题：${parsed.theme}\n当前视觉方向：${parsed.selectedOptionContent}\n\n` +
                `【仅用于上半部彩色区：主标题区 + 副标题条/辅助说明条，不要写入底部白块①②③】\n` +
                `活动主标题：${parsed.headline}\n活动副标题：${parsed.subheadline}\n活动说明文（用于副标题条或辅助条）：${parsed.description}\n\n` +
                `${footerPromptBlock}`
            ),
            inputText("图1：主视觉（KV）。请提取核心角色、材质与风格，按系统说明重构为横版推广 Banner。"),
            inputImage(parsed.mainVisualUrl),
            inputText(
              "图2：版式母版。底部白块内①②③与按钮文字以用户消息中的「固定底部文案」为准，须与图2参考一致；上半部主标题/副标题用活动文案；结构、留白比例、字体层级锁定图2。"
            ),
            inputImage(layoutDataUri),
          ],
        },
      ],
    });

    const prompt = response.output_text.trim();

    const mainRef = await urlToNanoReference("main_visual", parsed.mainVisualUrl);

    const nanoResult = await generateNanoImage({
      prompt,
      width: 2560,
      height: 1344,
      quality: "2k",
      referenceImages: [mainRef, layoutRef],
    });

    return NextResponse.json({
      prompt,
      imageUrl: nanoResult.imageUrl,
      width: 2560,
      height: 1344,
    });
  } catch (error: unknown) {
    let message = error instanceof Error ? error.message : "Failed to generate banner";
    if (message === "fetch failed") {
      message =
        "网络请求失败（fetch failed）。推广图步骤会访问：OpenAI、主视觉图片链接、Nanobanana。请检查本机/代理能否访问 api.openai.com 与 ai.t8star.cn；主视觉 URL 是否仍有效；必要时开 VPN 或关闭系统代理后再试。";
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
