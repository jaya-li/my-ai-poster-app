/**
 * 自定义模式 - 出图阶段：跳过 GPT PE，直接把前端送上来的 nano prompt
 *（用户在 PE 阶段编辑过的最终稿）+ 参考图 + 与 PE 同一份 layout 喂给 nanobanana，
 * 与 /api/generate-kv 的「PE → nano」第二段路径完全等价。
 *
 * 前端务必把 /api/generate-kv-pe 返回的 layoutBase64 + width/height 原样回传，
 * 否则会出现「PE 描述与最终图 1 不一致」的串味问题。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateNanoImage } from "@/lib/nanobanana";
import { tryNormalizeRemoteImageToLayoutPixels } from "@/lib/nano-output-normalize";
import { getKvCampaignOutputPixels } from "@/lib/kv-campaign-output-size";
import type { KvCampaignType } from "@/lib/kv-layout-builtin";
import {
  KvImageSchema,
  buildKvReferenceImages,
} from "@/lib/server/kv-generation-helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  prompt: z.string().min(1, "prompt 不能为空"),
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "tuijinbi", "baiyuan"])
    .optional()
    .default("scan"),
  /** /api/generate-kv-pe 返回的 layoutBase64 必须原样回传到这里。 */
  images: KvImageSchema,
  layoutWidth: z.number().int().positive().optional(),
  layoutHeight: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BodySchema.parse(body);
    const campaignType = parsed.campaignType as KvCampaignType;

    if (!parsed.images.layoutBase64?.trim()) {
      return NextResponse.json(
        { error: "缺少 images.layoutBase64（请把 /api/generate-kv-pe 返回的 layoutBase64 原样传回）" },
        { status: 400 }
      );
    }

    const fallbackPx = getKvCampaignOutputPixels(campaignType);
    const width = parsed.layoutWidth ?? fallbackPx.width;
    const height = parsed.layoutHeight ?? fallbackPx.height;

    const referenceImages = buildKvReferenceImages(campaignType, parsed.images);

    const nanoResult = await generateNanoImage({
      prompt: parsed.prompt,
      width,
      height,
      quality: "2k",
      referenceImages,
    });

    const imageUrl = await tryNormalizeRemoteImageToLayoutPixels(
      nanoResult.imageUrl,
      width,
      height
    );

    return NextResponse.json({
      result: { prompt: parsed.prompt, imageUrl, width, height },
      campaignType,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to generate KV from prompt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
