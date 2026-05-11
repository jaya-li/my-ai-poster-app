/**
 * 自定义模式 - PE 阶段：仅运行 GPT，把用户「想法 + 玩法 + 4 张参考图（可选）」
 * 转成可直接喂给 nanobanana 的中文 prompt，回传给前端二次编辑。
 *
 * 返回字段说明：
 *  - prompt：包含 nano refs 尾注（与 referenceImages 顺序一致），用户可整体改。
 *  - layoutBase64：本次真正用到的图1 dataURL（用户上传或随机抽到的内置）；
 *    /api/generate-kv-from-prompt 须接收同一份，避免「编 PE 时用 layout-A、出图却用 layout-B」。
 *  - layoutWidth / layoutHeight：最终成图分辨率；同上必须传给下一步以确保一致。
 *  - kvLayoutTemplate：内置随机命中的文件名（用户上传时为空）。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getImageSizeFromBuffer, stripDataUrlPrefix } from "@/lib/image";
import { getKvCampaignOutputPixels } from "@/lib/kv-campaign-output-size";
import { loadBuiltinKvLayoutDataUrl, type KvCampaignType } from "@/lib/kv-layout-builtin";
import {
  KvImageSchema,
  ChongbangSpecSchema,
  StarCollectSpecSchema,
  WheelSpecSchema,
  TuijinbiSpecSchema,
  buildKvPrompt,
  buildKvReferenceImages,
  buildCampaignNanoRefTail,
  buildWheelLocaleBlob,
} from "@/lib/server/kv-generation-helpers";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  /** 自定义模式用户输入的主创意/想法；将同时作为 theme 与 selectedOptionText 注入 PE。 */
  idea: z.string().min(1, "想法不能为空"),
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "tuijinbi", "baiyuan"])
    .optional()
    .default("scan"),
  chongbangSpec: ChongbangSpecSchema,
  starCollectSpec: StarCollectSpecSchema,
  wheelSpec: WheelSpecSchema,
  tuijinbiSpec: TuijinbiSpecSchema,
  images: KvImageSchema,
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
    const campaignType = parsed.campaignType as KvCampaignType;

    let layoutDataUrl: string;
    let kvLayoutTemplate: string | undefined;
    if (parsed.images.layoutBase64?.trim()) {
      layoutDataUrl = parsed.images.layoutBase64;
    } else {
      const builtin = await loadBuiltinKvLayoutDataUrl(campaignType, {
        wheelLocaleBlob:
          campaignType === "wheel"
            ? buildWheelLocaleBlob(parsed.idea, parsed.wheelSpec)
            : undefined,
      });
      layoutDataUrl = builtin.dataUrl;
      kvLayoutTemplate = builtin.filename;
    }

    const layoutBase64Pure = stripDataUrlPrefix(layoutDataUrl);
    const fallbackPx = getKvCampaignOutputPixels(campaignType);
    let width: number;
    let height: number;
    if (parsed.images.layoutBase64?.trim()) {
      try {
        const dim = await getImageSizeFromBuffer(Buffer.from(layoutBase64Pure, "base64"));
        width = dim.width;
        height = dim.height;
      } catch {
        width = fallbackPx.width;
        height = fallbackPx.height;
      }
    } else {
      width = fallbackPx.width;
      height = fallbackPx.height;
    }

    const imagesForKv = { ...parsed.images, layoutBase64: layoutDataUrl };
    const referenceImages = buildKvReferenceImages(campaignType, imagesForKv);
    const nanoRefOrderTail = buildCampaignNanoRefTail(
      campaignType,
      referenceImages,
      Boolean(imagesForKv.ipBase64)
    );

    let prompt = await buildKvPrompt({
      theme: parsed.idea,
      selectedOptionText: parsed.idea,
      layoutWidth: width,
      layoutHeight: height,
      campaignType,
      chongbangSpec: campaignType === "chongbang" ? parsed.chongbangSpec : undefined,
      starCollectSpec:
        campaignType === "star_collect" ? parsed.starCollectSpec : undefined,
      wheelSpec: campaignType === "wheel" ? parsed.wheelSpec : undefined,
      tuijinbiSpec: campaignType === "tuijinbi" ? parsed.tuijinbiSpec : undefined,
      images: imagesForKv,
    });
    if (nanoRefOrderTail) prompt = prompt.trim() + nanoRefOrderTail;

    return NextResponse.json({
      prompt,
      campaignType,
      layoutBase64: layoutDataUrl,
      layoutWidth: width,
      layoutHeight: height,
      ...(kvLayoutTemplate ? { kvLayoutTemplate } : {}),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to build KV prompt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
