import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import { inputText, inputImage } from "@/lib/response-content";
import { urlToNanoReference } from "@/lib/url-to-reference";
import { getImageSizeFromBuffer } from "@/lib/image";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  kind: z.enum(["kv", "banner"]).optional().default("kv"),
  sourceImageUrl: z.string().min(1),
  languageInstruction: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const KV_EDIT_GUIDE = `你是活动主视觉修图 Prompt 工程师。用户给出一张已生成的主视觉和一条「语言/文案」修改说明。
请输出**一段**可直接给图像生成模型执行的中文 prompt，要求：
- 整体构图、主体角色与装饰层次、色彩氛围与光影须与参考图一致；
- 将所有界面内可读文字（标题、副文、按钮、标签、时间、规则等）按用户说明改为对应语言或表述，信息层级与区块位置不变；
- 若图中有二维码或固定互动区，勿改其几何位置和占比。
只输出生图 prompt 正文，不要解释。`;

const KV_EDIT_GUIDE_BANNER = `你是横版推广 Banner 修图 Prompt 工程师。参考图为已生成的推广成品，用户给出「语言/文案」修改说明。
请输出**一段**可直接给图像生成模型执行的中文 prompt，要求：
- 整体分区（彩色主视觉区与白色说明区等）与原图一致，主体与配色氛围延续参考图；
- 按用户说明调整画面中可读文字的语言、本地化或措辞，信息层级与区块几何保持不变；
- 勿大幅改构图或替换主体题材。
只输出生图 prompt 正文，不要解释。`;

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
    const isBanner = parsed.kind === "banner";

    const ref = await urlToNanoReference(isBanner ? "banner_source" : "kv_source", parsed.sourceImageUrl);
    let width = parsed.width;
    let height = parsed.height;
    if (!width || !height) {
      const buf = Buffer.from(ref.base64, "base64");
      const dim = await getImageSizeFromBuffer(buf);
      width = dim.width;
      height = dim.height;
    }

    const layoutHint = `【输出尺寸】与参考图一致：${width}×${height} 像素。`;

    const response = await openai.responses.create({
      model: getOpenAIModel(),
      input: [
        {
          role: "user",
          content: [
            inputText(isBanner ? KV_EDIT_GUIDE_BANNER : KV_EDIT_GUIDE),
            inputText(layoutHint),
            inputText(`【修改要求】${parsed.languageInstruction}`),
            inputText(
              isBanner
                ? "【参考图】当前横版推广图，须在其基础上改字与语言。"
                : "【参考图】当前主视觉，须在其基础上改字与语言。"
            ),
            inputImage(`data:${ref.mimeType};base64,${ref.base64}`),
          ],
        },
      ],
    });

    const prompt = response.output_text.trim();

    const nanoResult = await generateNanoImage({
      prompt,
      width,
      height,
      quality: "2k",
      referenceImages: [ref],
    });

    return NextResponse.json({
      prompt,
      imageUrl: nanoResult.imageUrl,
      width,
      height,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to regenerate KV image";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
