import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import { inputText, inputImage, inputImageHigh } from "@/lib/response-content";
import { urlToNanoReference } from "@/lib/url-to-reference";
import { getImageSizeFromBuffer } from "@/lib/image";
import { KV_SPLIT_REFERENCE_BY_CAMPAIGN } from "@/lib/kv-split-reference";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  kind: z.enum(["kv", "banner"]).optional().default("kv"),
  mode: z.enum(["text_edit", "remove_ui", "split_layers"]).optional().default("text_edit"),
  sourceImageUrl: z.string().min(1),
  languageInstruction: z.string().optional().default(""),
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "baiyuan"])
    .optional()
    .default("scan"),
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

const KV_REMOVE_UI_GUIDE = `你是资深广告视觉去 UI 修图 Prompt Engineer。任务是把“当前主视觉”转换为“无 UI 纯视觉版”。

【目标（核心）】
仅移除界面化元素：标题/副标题、按钮、标签、徽标字、进度条、气泡文案、列表文案、角标数字、规则说明、可读字符、图标化 UI 控件、线框/卡片 UI 容器等。

【硬性约束（必须严格执行）】
1) 不改变画幅比例与输出尺寸。
2) 不改变主体内容：角色、道具、场景、透视关系、层级关系、镜头角度保持一致。
3) 不改变主体位置：主物体与关键元素的空间位置、大小占比、相互距离保持一致。
4) 不改变视觉气质：色彩体系、光影方向、材质风格、清晰度保持一致。
5) 仅做“减法编辑”：删除 UI 后进行自然背景/材质补全，不新增新的叙事元素。

【去除范围（尽可能完整）】
- 所有可读文字与数字（任意语言）
- 标题条、按钮条、信息卡、进度条、状态条、气泡框、说明区
- 与 UI 强绑定的图标/分割线/底板（如明显属于按钮或信息模块）

【禁止事项】
- 禁止重构画面、重排版、重画主体
- 禁止更换角色/道具/场景
- 禁止新增文字、logo、水印、装饰贴纸
- 禁止出现涂抹感、马赛克感、残字、幽灵边框、局部糊块

【成片标准】
结果必须看起来像“同一张主视觉去掉 UI 后的版本”：主体不动、构图不动、内容不变，只是 UI 与文字被干净移除并自然补全。请输出可直接用于生图模型的一段高质量中文 prompt。
只输出生图 prompt 正文，不要解释。`;

const KV_REMOVE_UI_REFERENCE: Partial<
  Record<"scan" | "chongbang" | "star_collect" | "wheel" | "baiyuan", string>
> = {
  scan: "saoma-quchuui.png",
  chongbang: "chongbang-quchuui.png",
  star_collect: "xingxing-quchuui.png",
  wheel: "zhuanpan-quchuui.png",
  baiyuan: "baiyuan-quchuui.png",
};

async function loadPublicImageDataUrl(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", filename);
  const buf = await fs.readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

type KvSplitLayerPlan = { key: string; label: string; instruction: string };

const KV_SPLIT_LAYER_PLAN: Record<
  "scan" | "chongbang" | "star_collect" | "wheel" | "baiyuan",
  KvSplitLayerPlan[]
> = {
  scan: [
    { key: "background", label: "背景", instruction: "仅保留背景环境与场景底层" },
    { key: "subject", label: "主体", instruction: "仅保留主体角色与核心道具，不含按钮/文案/UI" },
    { key: "others", label: "其他内容", instruction: "保留除背景与主体外的其余视觉元素，不含UI文字" },
  ],
  chongbang: [
    { key: "background", label: "背景", instruction: "仅保留背景与环境底层，不含领奖台和奖励物" },
    { key: "seven_rewards", label: "7个奖励", instruction: "仅保留7个奖励物（含其细节），其余元素透明" },
    { key: "podium", label: "领奖台结构", instruction: "仅保留领奖台主体结构，不含奖励物和背景" },
  ],
  star_collect: [
    { key: "background", label: "背景", instruction: "仅保留背景环境与场景底层" },
    { key: "main_collectibles", label: "主体与收集物", instruction: "仅保留主体与核心收集物，不含UI文字" },
    { key: "others", label: "其他内容", instruction: "保留除背景与主体外的其余视觉元素，不含UI文字" },
  ],
  wheel: [
    { key: "background", label: "背景", instruction: "仅保留背景底层，不含转盘、按钮与周边道具" },
    {
      key: "wheel_body_and_peripherals",
      label: "转盘本体和周边物品",
      instruction: "仅保留转盘本体与周边物品（含转盘底座、装饰道具），不含背景与下方按钮",
    },
    { key: "bottom_buttons", label: "下方按钮", instruction: "仅保留下方按钮区域（按钮及其紧邻部件）" },
  ],
  baiyuan: [
    { key: "background", label: "背景", instruction: "仅保留背景环境与场景底层" },
    { key: "subject", label: "主体", instruction: "仅保留主体角色与核心奖励容器，不含UI文字" },
    { key: "others", label: "其他内容", instruction: "保留除背景与主体外的其余视觉元素，不含UI文字" },
  ],
};

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
    const isRemoveUi = !isBanner && parsed.mode === "remove_ui";
    const isSplitLayers = !isBanner && parsed.mode === "split_layers";

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
    const instruction = parsed.languageInstruction.trim();
    if (!isBanner && !isRemoveUi && !isSplitLayers && !instruction) {
      return NextResponse.json({ error: "缺少修改说明" }, { status: 400 });
    }

    if (isSplitLayers) {
      const layerPlan = KV_SPLIT_LAYER_PLAN[parsed.campaignType];
      const splitRefCfg = KV_SPLIT_REFERENCE_BY_CAMPAIGN[parsed.campaignType];
      const layers: Array<{
        key: string;
        label: string;
        imageUrl: string;
        width: number;
        height: number;
        prompt: string;
      }> = [];

      for (const layer of layerPlan) {
        const layerContent = [
          inputText(
            "你是主视觉拆图 Prompt 工程师。请根据当前主视觉输出单层素材图：只保留指定层内容，其它区域透明。"
          ),
          inputText(layoutHint),
          inputText(
            `【目标层】${layer.label}。要求：${layer.instruction}。保持原图中该层元素的几何位置、尺寸、透视与细节清晰度，不可缩放、不可位移。`
          ),
          inputText(
            "【透明约束】非目标层区域必须透明（alpha=0），禁止填充纯色背景，禁止残影、毛边、糊边。"
          ),
          inputText(
            "【禁止事项】不得重绘主体风格，不得新增文字/图标/UI，不得替换内容来源。"
          ),
        ];
        if (instruction) {
          layerContent.push(inputText(`【补充要求】${instruction}`));
        }
        if (splitRefCfg?.filename) {
          try {
            const splitRefDataUrl = await loadPublicImageDataUrl(splitRefCfg.filename);
            layerContent.push(
              inputText(
                `【拆图参考（${splitRefCfg.filename}）】仅学习拆层边界与透明处理方式；严禁复用该参考图的具体内容。`
              )
            );
            layerContent.push(inputImageHigh(splitRefDataUrl));
          } catch {
            // ignore missing optional split reference
          }
        }
        layerContent.push(inputText("【当前主视觉】"));
        layerContent.push(inputImage(`data:${ref.mimeType};base64,${ref.base64}`));

        const promptResp = await openai.responses.create({
          model: getOpenAIModel(),
          input: [{ role: "user", content: layerContent }],
        });
        const layerPrompt = promptResp.output_text.trim();
        const layerImage = await generateNanoImage({
          prompt: layerPrompt,
          width,
          height,
          quality: "2k",
          referenceImages: [ref],
        });
        layers.push({
          key: layer.key,
          label: layer.label,
          imageUrl: layerImage.imageUrl,
          width,
          height,
          prompt: layerPrompt,
        });
      }

      return NextResponse.json({ layers, width, height });
    }

    const content = [
      inputText(isBanner ? KV_EDIT_GUIDE_BANNER : isRemoveUi ? KV_REMOVE_UI_GUIDE : KV_EDIT_GUIDE),
      inputText(layoutHint),
    ];
    if (!isBanner && !isRemoveUi) {
      content.push(inputText(`【修改要求】${instruction}`));
    }
    content.push(
      inputText(
        isBanner
          ? "【参考图】当前横版推广图，须在其基础上改字与语言。"
          : isRemoveUi
            ? "【参考图】当前主视觉，须在其基础上移除 UI 文案与界面元素。"
            : "【参考图】当前主视觉，须在其基础上改字与语言。"
      )
    );
    content.push(inputImage(`data:${ref.mimeType};base64,${ref.base64}`));

    if (isRemoveUi) {
      const refFile = KV_REMOVE_UI_REFERENCE[parsed.campaignType];
      if (refFile) {
        try {
          const removeUiRefDataUrl = await loadPublicImageDataUrl(refFile);
          content.push(
            inputText(
              `【去 UI 参考样例（${refFile}）】只学习“如何干净移除 UI 并自然补全”的编辑方式。严禁复用该参考图的角色、道具、场景、构图、配色或任何具体内容；当前输出必须完全基于“当前主视觉”本身做减法去 UI。`
            )
          );
          content.push(inputImageHigh(removeUiRefDataUrl));
        } catch {
          // 参考图缺失时降级为仅使用文本规则，不阻断主流程
        }
      }
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
