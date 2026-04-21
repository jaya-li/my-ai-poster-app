import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { DIRECTION_SYSTEM_PROMPT } from "@/lib/prompts";
import { inputText } from "@/lib/response-content";

export const runtime = "nodejs";

const BodySchema = z.object({
  theme: z.string().min(1, "theme is required"),
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
    const { theme } = BodySchema.parse(body);

    const response = await openai.responses.create({
      model: getOpenAIModel(),
      input: [
        {
          role: "system",
          content: [inputText(DIRECTION_SYSTEM_PROMPT)],
        },
        {
          role: "user",
          content: [inputText(`主题：${theme}`)],
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
