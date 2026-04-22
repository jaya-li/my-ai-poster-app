import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import { KV_PROMPT_SYSTEM } from "@/lib/prompts";
import {
  getImageMimeFromBase64,
  stripDataUrlPrefix,
  getImageSizeFromBuffer,
} from "@/lib/image";
import { inputText, inputImage, inputImageHigh } from "@/lib/response-content";
import type { ResponseInputContent } from "openai/resources/responses/responses";

export const runtime = "nodejs";

const ImageSchema = z.object({
  layoutBase64: z.string().optional(),
  styleBase64: z.string().optional(),
  ipBase64: z.string().optional(),
  coinBase64: z.string().optional(),
});

const OptionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  title: z.string(),
  content: z.string(),
});

const BodySchema = z.object({
  theme: z.string().min(1),
  selectedOptions: z.array(z.enum(["A", "B", "C", "D"])).min(1),
  optionContents: z.array(OptionSchema).length(4),
  images: ImageSchema,
});

async function buildKvPrompt(params: {
  theme: string;
  selectedOptionText: string;
  layoutWidth: number;
  layoutHeight: number;
  images: {
    layoutBase64?: string;
    styleBase64?: string;
    ipBase64?: string;
    coinBase64?: string;
  };
}) {
  const content: ResponseInputContent[] = [
    inputText(
      `${KV_PROMPT_SYSTEM}\n\n` +
        `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；二维码/文字区与图1的相对位置与占比必须对齐，见上文图1规则。\n\n` +
        `当前主题：${params.theme}\n当前选中的主视觉方向：${params.selectedOptionText}`
    ),
  ];

  if (params.images.layoutBase64) {
    content.push(
      inputText(
        "图1：版式锁定参考（请高分辨率阅读二维码外框与顶/底文字区边界）。请目测图中二维码模块+衬底整体约占画高、画宽的比例及居中关系，并在最终 prompt 中写出一致的可执行描述。"
      )
    );
    content.push(inputImageHigh(params.images.layoutBase64));
  }

  if (params.images.styleBase64) {
    content.push(
      inputText(
        "图2：画风参考（高优先级）。请细读渲染类型、色彩系统、光影与材质画法；成片必须与该画风一致，不要换成另一种美术体系；不要照搬本图构图。"
      )
    );
    content.push(inputImageHigh(params.images.styleBase64));
  }

  if (params.images.ipBase64) {
    content.push(
      inputText(
        "图3：IP 角色参考（高优先级）。主角色须与图为同一 IP：轮廓比例、配色分区、五官与标志性配饰须可辨认；可为扫码互动设计新动作与场景，禁止换脸或换成别的角色。"
      )
    );
    content.push(inputImageHigh(params.images.ipBase64));
  }

  if (params.images.coinBase64) {
    content.push(inputText("图4：金币装饰参考。"));
    content.push(inputImage(params.images.coinBase64));
  }

  const response = await openai.responses.create({
    model: getOpenAIModel(),
    input: [
      {
        role: "user",
        content,
      },
    ],
  });

  return response.output_text.trim();
}

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

    if (!parsed.images.layoutBase64) {
      return NextResponse.json({ error: "图1（版式参考）必传" }, { status: 400 });
    }

    const layoutBase64Pure = stripDataUrlPrefix(parsed.images.layoutBase64);
    const layoutBuffer = Buffer.from(layoutBase64Pure, "base64");
    const { width, height } = await getImageSizeFromBuffer(layoutBuffer);

    const results = [];

    for (const key of parsed.selectedOptions) {
      const selected = parsed.optionContents.find((item) => item.key === key);
      if (!selected) continue;

      const prompt = await buildKvPrompt({
        theme: parsed.theme,
        selectedOptionText: selected.content,
        layoutWidth: width,
        layoutHeight: height,
        images: parsed.images,
      });

      const referenceImages = [
        parsed.images.layoutBase64
          ? {
              name: "layout",
              base64: stripDataUrlPrefix(parsed.images.layoutBase64),
              mimeType: getImageMimeFromBase64(parsed.images.layoutBase64),
            }
          : null,
        parsed.images.styleBase64
          ? {
              name: "style",
              base64: stripDataUrlPrefix(parsed.images.styleBase64),
              mimeType: getImageMimeFromBase64(parsed.images.styleBase64),
            }
          : null,
        parsed.images.ipBase64
          ? {
              name: "ip",
              base64: stripDataUrlPrefix(parsed.images.ipBase64),
              mimeType: getImageMimeFromBase64(parsed.images.ipBase64),
            }
          : null,
        parsed.images.coinBase64
          ? {
              name: "coin",
              base64: stripDataUrlPrefix(parsed.images.coinBase64),
              mimeType: getImageMimeFromBase64(parsed.images.coinBase64),
            }
          : null,
      ].filter(Boolean) as Array<{ name: string; base64: string; mimeType: string }>;

      const nanoResult = await generateNanoImage({
        prompt,
        width,
        height,
        quality: "2k",
        referenceImages,
      });

      results.push({
        optionKey: key,
        prompt,
        imageUrl: nanoResult.imageUrl,
        width,
        height,
      });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate KV";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
