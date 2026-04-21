import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import { BANNER_PROMPT_SYSTEM } from "@/lib/prompts";
import { inputText, inputImage } from "@/lib/response-content";

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

    const bannerRefPath = path.join(process.cwd(), "public", "promo-layout-ref.png");
    const file = await fs.readFile(bannerRefPath);
    const base64 = `data:image/png;base64,${file.toString("base64")}`;

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
              `当前主题：${parsed.theme}\n当前视觉方向：${parsed.selectedOptionContent}\n文案如下：\n主标题：${parsed.headline}\n副标题：${parsed.subheadline}\n说明文字：${parsed.description}`
            ),
            inputText("图1：主视觉图，请提取角色、材质、风格，并做营销Banner重构。"),
            inputImage(parsed.mainVisualUrl),
            inputText("图2：营销Banner构图参考。"),
            inputImage(base64),
          ],
        },
      ],
    });

    const prompt = response.output_text.trim();

    const nanoResult = await generateNanoImage({
      prompt,
      width: 2560,
      height: 1344,
      quality: "2k",
      referenceImages: [],
    });

    return NextResponse.json({
      prompt,
      imageUrl: nanoResult.imageUrl,
      width: 2560,
      height: 1344,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate banner";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
