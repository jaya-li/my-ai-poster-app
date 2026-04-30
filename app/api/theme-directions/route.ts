import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { DIRECTION_SYSTEM_PROMPT } from "@/lib/prompts";
import { inputText } from "@/lib/response-content";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  theme: z.string().min(1, "theme is required"),
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "baiyuan"])
    .optional()
    .default("scan"),
});

function parseDirections(raw: string) {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const map: Record<"A" | "B" | "C" | "D", string> = {
    A: "",
    B: "",
    C: "",
    D: "",
  };

  for (const line of lines) {
    const matched = line.match(/^([ABCD])[：:、\s]*(.*)$/i);
    if (matched) {
      const key = matched[1].toUpperCase() as "A" | "B" | "C" | "D";
      map[key] = matched[2].trim();
    }
  }

  return (["A", "B", "C", "D"] as const).map((key) => ({
    key,
    title: `${key}方案`,
    content: map[key] || "",
  }));
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
    const { theme, campaignType } = BodySchema.parse(body);

    const playHint =
      campaignType === "chongbang"
        ? "\n\n【玩法限定】四个方向须适合**冲榜/榜单排行**类主视觉（竞争感、排名、荣誉感、挑战欲、榜单符号等氛围锚点），不要默认写成纯「扫码领券」导购语气。"
        : campaignType === "star_collect"
          ? "\n\n【玩法限定】四个方向须适合**星星收集 / 集物入容器**类主视觉（收集动机、容器渐满、进度感、奖励气泡、同一种收集物体系等氛围锚点），不要默认写成纯「扫码领券」导购语气。"
          : campaignType === "wheel"
            ? "\n\n【玩法限定】四个方向须适合**转盘抽奖**类主视觉（转动停格、随机奖池、指针与扇区、参与感与惊喜感等氛围锚点），不要默认写成纯「扫码领券」导购语气。"
            : campaignType === "baiyuan"
              ? "\n\n【玩法限定】四个方向须适合**百元 / App 大促 KV** 类主视觉（双角色围合中央大奖、纯白底促销氛围、强奖励感与参与感、进度或数值锚点等，与图1 母版气质一致），不要默认写成纯「扫码领券」导购语气。"
              : "\n\n【玩法限定】四个方向须适合**扫码导流/活动参与**类主视觉（可自然包含物料、到店、扫码参与等心智，不必堆砌技术说明）。";

    const response = await openai.responses.create({
      model: getOpenAIModel(),
      input: [
        {
          role: "system",
          content: [inputText(DIRECTION_SYSTEM_PROMPT)],
        },
        {
          role: "user",
          content: [
            inputText(
              `主题：${theme}${playHint}\n\n请严格紧扣该主题的地域、赛事与文化语境生成 A～D；勿使用主题未提及国家的日常场景作默认背景（例如主题与巴西相关时不要写东京、居酒屋、和风祭典等）。`
            ),
          ],
        },
      ],
    });

    const rawText = response.output_text;
    const options = parseDirections(rawText);

    return NextResponse.json({
      theme,
      options,
      rawText,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate directions";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
