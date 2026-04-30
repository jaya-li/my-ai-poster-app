import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import {
  KV_PROMPT_SYSTEM,
  buildBaiyuanKvInstructionBlock,
  buildChongbangKvInstructionBlock,
  buildStarCollectKvInstructionBlock,
  buildWheelKvInstructionBlock,
  type ChongbangKvSpec,
  type StarCollectKvSpec,
  type WheelKvSpec,
} from "@/lib/prompts";
import {
  getImageMimeFromBase64,
  stripDataUrlPrefix,
  getImageSizeFromBuffer,
} from "@/lib/image";
import { inputText, inputImage, inputImageHigh } from "@/lib/response-content";
import type { ResponseInputContent } from "openai/resources/responses/responses";

import { loadBuiltinKvLayoutDataUrl, type KvCampaignType } from "@/lib/kv-layout-builtin";

export const runtime = "nodejs";
/** Vercel：Pro 最高可调至 300s；Hobby 仍约 10s 上限，多选方向时请升级或单次少选 */
export const maxDuration = 300;

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

const ChongbangSpecSchema = z
  .object({
    targetLanguage: z.string().optional(),
    scene: z.string().optional(),
    rewardItems: z.string().optional(),
    decorativeElements: z.string().optional(),
    primaryColor: z.string().optional(),
    mascotBrief: z.string().optional(),
    coinVariation: z.string().optional(),
    moodKeywords: z.string().optional(),
  })
  .optional();

const StarCollectSpecSchema = z
  .object({
    targetLanguage: z.string().optional(),
    collectible: z.string().optional(),
    container: z.string().optional(),
    scene: z.string().optional(),
    decorativeElements: z.string().optional(),
    primaryColor: z.string().optional(),
    ipBrief: z.string().optional(),
    coinVariation: z.string().optional(),
    moodKeywords: z.string().optional(),
  })
  .optional();

const WheelSpecSchema = z
  .object({
    targetLanguage: z.string().optional(),
    scene: z.string().optional(),
    prizeElements: z.string().optional(),
    decorativeElements: z.string().optional(),
    primaryColor: z.string().optional(),
    ipBrief: z.string().optional(),
    coinVariation: z.string().optional(),
    moodKeywords: z.string().optional(),
  })
  .optional();

const BodySchema = z.object({
  theme: z.string().min(1),
  selectedOptions: z.array(z.enum(["A", "B", "C", "D"])).min(1),
  optionContents: z.array(OptionSchema).length(4),
  /** 不传 layoutBase64 时使用内置版式；与 campaignType 决定随机池 */
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "baiyuan"])
    .optional()
    .default("scan"),
  /** 仅 campaignType=chongbang 时使用；字段均可选 */
  chongbangSpec: ChongbangSpecSchema,
  /** 仅 campaignType=star_collect 时使用；字段均可选 */
  starCollectSpec: StarCollectSpecSchema,
  /** 仅 campaignType=wheel 时使用；字段均可选 */
  wheelSpec: WheelSpecSchema,
  images: ImageSchema,
});

async function buildKvPrompt(params: {
  theme: string;
  selectedOptionText: string;
  layoutWidth: number;
  layoutHeight: number;
  campaignType: KvCampaignType;
  chongbangSpec?: ChongbangKvSpec | null;
  starCollectSpec?: StarCollectKvSpec | null;
  wheelSpec?: WheelKvSpec | null;
  images: {
    layoutBase64?: string;
    styleBase64?: string;
    ipBase64?: string;
    coinBase64?: string;
  };
}) {
  let systemAndTaskBlock: string;
  if (params.campaignType === "chongbang") {
    const pe = buildChongbangKvInstructionBlock(
      params.theme,
      params.selectedOptionText,
      params.chongbangSpec
    );
    systemAndTaskBlock =
      `你是广告视觉 Prompt Engineer。我会提供主题、参考图与冲榜专用 PE。你要输出**一段**可直接给 nanobanana 执行的中文生图 prompt。\n\n` +
      `【冲榜 / App 活动页】若图1 为榜单或 podium 类母版，下述「冲榜 PE」中关于**结构锁定、7 档奖励位、全页单一语言**等要求，优先于通用条款里仅针对「二维码营销海报」的表述；**图1 无二维码区时不要虚构二维码**。\n\n` +
      `${KV_PROMPT_SYSTEM}\n\n---\n\n${pe}\n\n---\n\n` +
      `须同时体现：同一套冲榜玩法页面结构、主题换肤感、竞争张力、统一氛围。\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 各功能区块的几何位置、分区比例与信息层级须对齐。`;
  } else if (params.campaignType === "star_collect") {
    const pe = buildStarCollectKvInstructionBlock(
      params.theme,
      params.selectedOptionText,
      params.starCollectSpec
    );
    systemAndTaskBlock =
      `你是广告视觉 Prompt Engineer。我会提供主题、参考图与**星星收集（集物入容器）**专用 PE。你要输出**一段**可直接给 nanobanana 执行的中文生图 prompt。\n\n` +
      `【星星收集玩法】若图1 为活动页级母版，下述专用 PE 中关于**结构锁定、中部收集与容器装满叙事、收集物体系统一、全页单一语言、金币位置保留**等要求，优先于通用条款里仅针对「二维码营销海报」的表述；**图1 无二维码区时不要虚构二维码**。\n\n` +
      `${KV_PROMPT_SYSTEM}\n\n---\n\n${pe}\n\n---\n\n` +
      `须同时体现：同一套收集玩法页面结构、主题换肤感、「收集物入容器渐满」可读性、收集物与进度强关联、统一氛围。\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 各功能区块的几何位置、分区比例与信息层级须对齐。`;
  } else if (params.campaignType === "wheel") {
    const pe = buildWheelKvInstructionBlock(
      params.theme,
      params.selectedOptionText,
      params.wheelSpec
    );
    systemAndTaskBlock =
      `你是广告视觉 Prompt Engineer。我会提供主题、参考图与**转盘抽奖**专用 PE。你要输出**一段**可直接给 nanobanana 执行的中文生图 prompt。\n\n` +
      `【转盘抽奖玩法】若图1 为活动页级母版，下述专用 PE 中关于**结构锁定、转盘扇区数量与分割及指针/中心钮几何不变、只换肤与奖品图、全页单一语言、金币位置保留、IP 不挡转盘**等要求，优先于通用条款里仅针对「二维码营销海报」的表述；**图1 无二维码区时不要虚构二维码**。\n\n` +
      `${KV_PROMPT_SYSTEM}\n\n---\n\n${pe}\n\n---\n\n` +
      `须同时体现：同一套转盘玩法页面结构、主题换肤感、「点击转动随机停格获奖」可读性、指针与扇区关系清楚、统一氛围。\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 各功能区块的几何位置、分区比例与信息层级须对齐。`;
  } else if (params.campaignType === "baiyuan") {
    const pe = buildBaiyuanKvInstructionBlock(params.theme, params.selectedOptionText);
    systemAndTaskBlock =
      `【百元玩法 / App 大促 KV】下述专用 PE 为最高优先级；**不要**套用通用二维码海报条款去虚构图1中不存在的模块。\n\n` +
      `${pe}\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 顶部文字层级、中部控件、侧边气泡、底部按钮等区域的几何位置、分区比例与信息层级须对齐。`;
  } else {
    const playHint =
      "当前主视觉玩法：**扫码参与**。若版式含二维码区，须保持可扫与几何对齐。";
    systemAndTaskBlock =
      `${KV_PROMPT_SYSTEM}\n\n` +
      `${playHint}\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1中非创作区的位置与占比须对齐，见上文图1规则。\n\n` +
      `当前主题：${params.theme}\n当前选中的主视觉方向：${params.selectedOptionText}`;
  }

  const content: ResponseInputContent[] = [inputText(systemAndTaskBlock)];

  if (params.images.layoutBase64) {
    let layoutHint: string;
    if (params.campaignType === "chongbang") {
      layoutHint =
        "图1：版式锁定参考（**冲榜 / App 活动页母版**）。请细读状态栏、标题区、时间条、podium 七奖励位、个人信息卡、排行榜、底部 CTA、规则区等区块的相对位置与留白；占位文案仅示结构须替换为「本次参数」语言，勿改区块几何。";
    } else if (params.campaignType === "star_collect") {
      layoutHint =
        "图1：版式锁定参考（**星星收集 / 集物入容器活动页母版**）。请细读状态栏、顶部 tab 与标题区、中部主视觉区（容器与收集叙事）、进度相关模块、浮动气泡区、底部 CTA 等区块的相对位置与留白；占位文案仅示结构须替换为「本次参数」语言，勿改区块几何。";
    } else if (params.campaignType === "wheel") {
      layoutHint =
        "图1：版式锁定参考（**转盘抽奖活动页母版**）。请细读状态栏、顶部标题区、奖励信息卡区、倒计时/进度区、主转盘区（扇区数量与径向分割、中心按钮、指针位置须与母版一致）、底部主按钮区、左右辅助按钮区、底部说明区等区块的相对位置与留白；占位文案仅示结构须替换为「本次参数」语言，勿改区块几何。";
    } else if (params.campaignType === "baiyuan") {
      layoutHint =
        "图1：版式锁定参考（**百元 / App 大促 KV 母版**）。严格锁定：顶部文字层级、中部控件/进度条、侧边气泡、底部 CTA 按钮的大小、位置、比例与留白；占位文案仅示结构，勿改区块几何；**不新增**多余可读文字图层。";
    } else {
      layoutHint =
        "图1：版式锁定参考（请高分辨率阅读二维码外框与顶/底文字区边界）。请目测图中二维码模块+衬底整体约占画高、画宽的比例及居中关系，并在最终 prompt 中写出一致的可执行描述。";
    }
    content.push(inputText(layoutHint));
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
    let ipHint: string;
    if (params.campaignType === "chongbang") {
      ipHint =
        "图3：IP 角色参考（高优先级）。主角色须与图为同一 IP：轮廓比例、配色分区、五官与标志性配饰须可辨认；可为榜单/冲榜主题设计新动作与场景，禁止换脸或换成别的角色。你输出的生图 prompt 里必须列出至少 5 条可对照图3的具体外观锚点（物种/毛色/服饰/头饰/涂装/体型等），不得使用泛称。";
    } else if (params.campaignType === "star_collect") {
      ipHint =
        "图3：IP 角色参考（可选，高优先级）。主角色须与图为同一 IP：轮廓比例、配色分区、五官与标志性配饰须可辨认；在星星收集玩法中 IP **仅能做辅助**，不得遮挡或抢夺中部收集物与容器焦点；可为容器/收集主题设计新姿态与场景，禁止换脸或换成别的角色。你输出的生图 prompt 里必须列出至少 5 条可对照图3的具体外观锚点，不得使用泛称。";
    } else if (params.campaignType === "wheel") {
      ipHint =
        "图3：IP 角色参考（可选，高优先级）。主角色须与图为同一 IP：轮廓比例、配色分区、五官与标志性配饰须可辨认；在转盘抽奖玩法中 IP **仅能做辅助装饰**，不得遮挡转盘、中心按钮与指针，不得抢夺转盘主视觉焦点；禁止换脸或换成别的角色。你输出的生图 prompt 里必须列出至少 5 条可对照图3的具体外观锚点，不得使用泛称。";
    } else if (params.campaignType === "baiyuan") {
      ipHint =
        "图3：IP 角色参考（高优先级）。须化身为符合主题的**双角色紧密互动**：沿用图3 同一 IP 的可识别特征（至少 5 条具体外观锚点写入最终 prompt）；右侧主角大比例、强引导至中央大奖，左侧配角呼应；禁止换脸或换成别的角色。";
    } else {
      ipHint =
        "图3：IP 角色参考（高优先级）。主角色须与图为同一 IP：轮廓比例、配色分区、五官与标志性配饰须可辨认；可为扫码互动设计新动作与场景，禁止换脸或换成别的角色。你输出的生图 prompt 里必须列出至少 5 条可对照图3的具体外观锚点（物种/毛色/服饰/头饰/涂装/体型等），不得使用泛称。";
    }
    content.push(inputText(ipHint));
    content.push(inputImageHigh(params.images.ipBase64));
  }

  if (params.images.coinBase64) {
    let coinHint: string;
    if (params.campaignType === "chongbang") {
      coinHint =
        "图4：金币/奖励代币参考。须结合 PE 中 podium **7 档等级差异**（体积、精致度、堆叠感、镶边光效、稀有装饰），不可 7 位简单重复同一枚币。";
    } else if (params.campaignType === "star_collect") {
      coinHint =
        "图4：金币/积分币参考。原版图式中凡须体现金币或积分币的位置成片均须保留；吸收图4 质感与镶边习惯并按主题融合，禁止通用金币贴片感；浮动奖励须为「收集物 + 数值」体系，与容器内堆积物同一种收集物语言，勿用 IP 头像作为气泡主体。";
    } else if (params.campaignType === "wheel") {
      coinHint =
        "图4：金币/积分币参考。原版图式中凡须体现金币或积分币的位置成片均须保留；吸收图4 质感与镶边习惯并按主题融合，须有明确奖励币识别感，禁止通用金币贴片感。";
    } else if (params.campaignType === "baiyuan") {
      coinHint =
        "图4：金币/核心奖励材质参考。须自然、集中地融入正中央「核心奖励容器」，与双 IP 叙事一致；吸收图4 金属质感与币面样式，禁止散乱漂浮的通用金币贴片。";
    } else {
      coinHint = "图4：金币装饰参考。";
    }
    content.push(inputText(coinHint));
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

    const campaignType = parsed.campaignType as KvCampaignType;

    let layoutDataUrl: string;
    let kvLayoutTemplate: string | undefined;

    if (parsed.images.layoutBase64?.trim()) {
      layoutDataUrl = parsed.images.layoutBase64;
    } else {
      const builtin = await loadBuiltinKvLayoutDataUrl(campaignType);
      layoutDataUrl = builtin.dataUrl;
      kvLayoutTemplate = builtin.filename;
    }

    const layoutBase64Pure = stripDataUrlPrefix(layoutDataUrl);
    const layoutBuffer = Buffer.from(layoutBase64Pure, "base64");
    const { width, height } = await getImageSizeFromBuffer(layoutBuffer);

    const imagesForKv: typeof parsed.images = {
      ...parsed.images,
      layoutBase64: layoutDataUrl,
    };

    const order = new Map(parsed.selectedOptions.map((k, i) => [k, i]));

    /** 版式 → IP → 画风 → 金币；串行请求减轻上游内存峰值（避免多方向并行 503） */
    const referenceImages = [
      {
        name: "layout",
        base64: layoutBase64Pure,
        mimeType: getImageMimeFromBase64(layoutDataUrl),
      },
      imagesForKv.ipBase64
        ? {
            name: "ip",
            base64: stripDataUrlPrefix(imagesForKv.ipBase64),
            mimeType: getImageMimeFromBase64(imagesForKv.ipBase64),
          }
        : null,
      imagesForKv.styleBase64
        ? {
            name: "style",
            base64: stripDataUrlPrefix(imagesForKv.styleBase64),
            mimeType: getImageMimeFromBase64(imagesForKv.styleBase64),
          }
        : null,
      imagesForKv.coinBase64
        ? {
            name: "coin",
            base64: stripDataUrlPrefix(imagesForKv.coinBase64),
            mimeType: getImageMimeFromBase64(imagesForKv.coinBase64),
          }
        : null,
    ].filter(Boolean) as Array<{ name: string; base64: string; mimeType: string }>;

    const ipPromptTailByCampaign: Record<KvCampaignType, string> = {
      scan:
        " 【参考图顺序】第1张版式锁定；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、场景与和二维码的互动方式可创新。",
      chongbang:
        " 【参考图顺序】第1张版式锁定（冲榜母版）；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、场景与主视觉/榜单预留区的互动方式可创新。",
      star_collect:
        " 【参考图顺序】第1张版式锁定（星星收集活动页母版）；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、场景与主视觉收集区/容器叙事的互动方式可创新；IP 不得抢夺收集物与容器焦点。",
      wheel:
        " 【参考图顺序】第1张版式锁定（转盘抽奖活动页母版）；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、配角位置与氛围可创新；IP 不得遮挡转盘、中心按钮与指针，不得抢夺转盘主视觉焦点。",
      baiyuan:
        " 【参考图顺序】第1张百元/App 大促 KV 版式锁定；第2张为 IP 双角色形象锁定，成片须为同一 IP 体系下的主题化双角色（右主左辅），紧密围合中央大奖；其后为画风与金币/奖励材质参考（若有）。背景须为纯白摄影棚、中央奖励容器与图4 金币须集中融合，禁止杂乱漂浮物。",
    };
    const ipPromptTail = imagesForKv.ipBase64 ? ipPromptTailByCampaign[campaignType] : "";

    const results: Array<{
      optionKey: (typeof parsed.selectedOptions)[number];
      prompt: string;
      imageUrl: string;
      width: number;
      height: number;
    }> = [];

    for (const key of parsed.selectedOptions) {
      const selected = parsed.optionContents.find((item) => item.key === key);
      if (!selected) continue;

      let prompt = await buildKvPrompt({
        theme: parsed.theme,
        selectedOptionText: selected.content,
        layoutWidth: width,
        layoutHeight: height,
        campaignType,
        chongbangSpec: campaignType === "chongbang" ? parsed.chongbangSpec : undefined,
        starCollectSpec: campaignType === "star_collect" ? parsed.starCollectSpec : undefined,
        wheelSpec: campaignType === "wheel" ? parsed.wheelSpec : undefined,
        images: imagesForKv,
      });
      if (ipPromptTail) {
        prompt = prompt.trim() + ipPromptTail;
      }

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

    results.sort((a, b) => (order.get(a.optionKey) ?? 0) - (order.get(b.optionKey) ?? 0));

    return NextResponse.json({
      results,
      campaignType,
      ...(kvLayoutTemplate ? { kvLayoutTemplate } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate KV";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
