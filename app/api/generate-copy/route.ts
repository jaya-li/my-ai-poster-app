import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { openai, getOpenAIModel } from "@/lib/openai";
import { COPYWRITING_SYSTEM_PROMPT } from "@/lib/prompts";
import { inputText } from "@/lib/response-content";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  theme: z.string().min(1),
  selectedOptionKey: z.enum(["A", "B", "C", "D"]),
  selectedOptionContent: z.string().min(1),
});

function parseCopy(raw: string) {
  const headline = raw.match(/主标题[：:](.*)/)?.[1]?.trim() || "";
  const subheadline = raw.match(/副标题[：:](.*)/)?.[1]?.trim() || "";
  const description = raw.match(/说明文字[：:](.*)/)?.[1]?.trim() || "";
  return { headline, subheadline, description, raw };
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

    const txtPath = path.join(process.cwd(), "data", "jp-ad-copies.txt");
    const txtContent = await fs.readFile(txtPath, "utf-8");

    const response = await openai.responses.create({
      model: getOpenAIModel(),
      input: [
        {
          role: "system",
          content: [inputText(COPYWRITING_SYSTEM_PROMPT)],
        },
        {
          role: "user",
          content: [
            inputText(
              `当前主题：${parsed.theme}\n当前选中的视觉方向：${parsed.selectedOptionContent}\n\n` +
                `【项目说明】主视觉为带 QR 的活动海报；用户扫码进入 App，通过分享、邀请、轻量任务等获得积分/优惠券/类福利。请按系统说明**判断目标市场与语言**，写出易传播的半幅标题文案（主/副/说明三行同语言），并自然呼应「扫码参与 + 分享裂变」心智，不要复述本说明。\n\n` +
                `【日语广告语参考文件】（仅在日本市场判定时重点使用；其它市场勿照搬翻译）\n${txtContent}`
            ),
          ],
        },
      ],
    });

    const parsedCopy = parseCopy(response.output_text);
    return NextResponse.json(parsedCopy);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate copy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
