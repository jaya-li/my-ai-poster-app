import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { openai, getOpenAIModel } from "@/lib/openai";
import { generateNanoImage } from "@/lib/nanobanana";
import { tryNormalizeRemoteImageToLayoutPixels } from "@/lib/nano-output-normalize";
import { inputText, inputImage, inputImageHigh } from "@/lib/response-content";
import { urlToNanoReference } from "@/lib/url-to-reference";
import { getImageSizeFromBuffer } from "@/lib/image";
import { getKvCampaignOutputPixels } from "@/lib/kv-campaign-output-size";
import { KV_SPLIT_REFERENCE_BY_CAMPAIGN } from "@/lib/kv-split-reference";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  kind: z.enum(["kv", "banner"]).optional().default("kv"),
  mode: z.enum(["text_edit", "remove_ui", "split_layers"]).optional().default("text_edit"),
  sourceImageUrl: z.string().min(1),
  languageInstruction: z.string().optional().default(""),
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "tuijinbi", "baiyuan"])
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

const KV_REMOVE_UI_GUIDE = `你是资深**局部去 UI**修图 Prompt Engineer。任务不是「按同主题新画一张」，而是**同一张成稿去掉界面图层**：除原 UI/文字所占像素外，**其余画面与参考须像同一文件里关掉文字层一样一致**。

【最高优先级：防整图篡改】
- 把编辑理解为**蒙版内修补（inpainting）**：只允许改动「曾经被文字、数字、按钮条、标签条、进度条、卡片区衬底等 UI 物理盖住」的像素；**蒙版外一切像素在造型、色相、明暗、材质、细节上与参考须保持连续一致**。
- **禁止**：整幅重绘、换画风、换调色滤镜、整体提高饱和度/对比度、重新打光、景深虚化、美颜式磨皮、改主体比例或「优化」角色脸与肢体。
- **禁止**：因去掉 UI 而「顺便」改写背景、加新道具、挪动机位或重摆主体。

【目标（只减不加）】
移除：标题/副标题、按钮与按钮内字、标签、徽标字、进度条、气泡与列表文案、角标、规则说明、**独立可读字符**、明显属于界面模块的线框与半透明卡底板（若去掉会露底则仅用邻近纹理补满，不新发明图案）。

【修补规则（像素级）】
- 去掉文字/按钮后露出的区域，用**邻近背景或底材的纹理与明暗方向**延伸填补，像内容识别填充；条纹、渐变、木纹、天空等须沿原方向延续。
- 若某条 UI 横条横跨画面，补完后该区域的材质须与同高度左右未遮挡处**无缝衔接**，不得出现与周围无关的新色块。

【硬性约束】
1) 画幅与输出尺寸与参考一致。
2) 镜头、透视、构图骨架不变；地平线、消失点、各模块几何占位不变。
3) 角色、吉祥物、产品、场景建筑、转盘/宫格/道具**非 UI 部分**轮廓与配色块不变。
4) 仅做「减法+缺口补全」，**零**叙事性新增（无新人物、无新标语装饰、无新光斑故事）。

【禁止事项】
- 禁止重构排版、禁止换主体或换场景
- 禁止残留半字、鬼影描边、马赛克塊、脏涂抹

【写给下游模型的句式要求】
你的输出 prompt 中必须**明确写出**类似含义：**以参考图为锚、仅擦除 UI 像素并修复缺口，未遮挡区域锁死与参考一致**；不要使用「重新设计一张」「全新 KV」等诱发整图生成的表述。

【成片标准】
观众应感觉：**同一张图关了 UI**，而不是换了一版主视觉。

请输出**一段**可直接给图像生成模型执行的高质量中文 prompt（可含逗号分隔的执行要点），**不要**前言后语与解释。`;

const KV_REMOVE_UI_REFERENCE: Partial<
  Record<"scan" | "chongbang" | "star_collect" | "wheel" | "tuijinbi" | "baiyuan", string>
> = {
  scan: "saoma-quchuui.png",
  chongbang: "chongbang-quchuui.png",
  star_collect: "xingxing-quchuui.png",
  wheel: "zhuanpan-quchuui.png",
  tuijinbi: "tuijinbi-quchuui.png",
  baiyuan: "baiyuan-quchuui.png",
};

async function loadPublicImageDataUrl(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", filename);
  const buf = await fs.readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

type KvSplitLayerPlan = { key: string; label: string; instruction: string };

const KV_SPLIT_LAYER_PLAN: Record<
  "scan" | "chongbang" | "star_collect" | "wheel" | "tuijinbi" | "baiyuan",
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
  tuijinbi: [
    {
      key: "background",
      label: "背景",
      instruction: "仅保留画面上半与周缘氛围背景，不含**中部奖品格阵列**外框、滑道/台面、球体堆与底部控制区",
    },
    {
      key: "tuijinbi_playfield",
      label: "奖格与台前球区",
      instruction:
        "保留**中部奖品格阵列**：列数与行数须与当前主视觉一致；含外框（球门/木架/灯箱等）、滑道或格下过渡层、落物台上的 Hero 与球/币堆；不含顶栏 UI 与最底控制条",
    },
    {
      key: "bottom_buttons",
      label: "底部控制台",
      instruction:
        "仅保留底部控制条：若为「中央主行动按钮 + 左右圆形次级按钮」则整块保留（含扫码或 QR 入口占位若存在）；若为三条等宽横键母版则保留三条按键及其紧邻装饰",
    },
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
    let width: number;
    let height: number;
    if (isBanner) {
      if (parsed.width && parsed.height) {
        width = parsed.width;
        height = parsed.height;
      } else {
        const buf = Buffer.from(ref.base64, "base64");
        const dim = await getImageSizeFromBuffer(buf);
        width = dim.width;
        height = dim.height;
      }
    } else {
      if (parsed.width && parsed.height) {
        width = parsed.width;
        height = parsed.height;
      } else {
        try {
          const buf = Buffer.from(ref.base64, "base64");
          const dim = await getImageSizeFromBuffer(buf);
          width = dim.width;
          height = dim.height;
        } catch {
          ({ width, height } = getKvCampaignOutputPixels(parsed.campaignType));
        }
      }
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
            const splitRefCaption =
              parsed.campaignType === "tuijinbi"
                ? `【推金币拆图参考（${splitRefCfg.filename}）】该图为**分层边界示意**（黑底上多块独立素材）：左≈上半/周缘背景；中≈**中部奖品格阵列 + 格架与外框及台面 / 滑道过渡 + Hero 与前景堆体的一体化游玩区壳层**；右≈底控制台。**拆层时对齐分界**，只学边界习惯，严禁把示意图内容画进输出；输出像素须完全来自下方「当前主视觉」。`
                : `【拆图参考（${splitRefCfg.filename}）】仅学习拆层边界与透明处理方式；严禁复用该参考图的具体内容。`;
            layerContent.push(inputText(splitRefCaption));
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
        const layerImageUrl = await tryNormalizeRemoteImageToLayoutPixels(
          layerImage.imageUrl,
          width,
          height
        );
        layers.push({
          key: layer.key,
          label: layer.label,
          imageUrl: layerImageUrl,
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
            ? "【参考图＝唯一母本】已附同一文件。任务：**仅移除 UI/可读文案像素**；凡未被文字、按钮条、进度条、信息卡等控件**直接遮挡**的区域，必须与参考在造型、色相、光影、材质上**保持同一连续画面**，禁止整图重画、禁止换滤镜调色、禁止改动主体与背景结构。修补仅限原 UI 条带内的缺口融合。"
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
              `【去 UI 参考样例（${refFile}）】只学习「在原图上剜掉字与控件条、用周边纹理填平」的**手术式**编辑，不学习样例里的角色与场景。对你而言**真正有效的母本只有上一条「当前主视觉」大图**：写成稿时须强调与原图非 UI 区域逐区对齐，禁止借样例换题重画。`
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

    let prompt = response.output_text.trim();
    if (isRemoveUi) {
      prompt =
        "【根参考锁死】严格以附带参考图为唯一基底：仅擦除/填补原 UI、按钮条、可读文字所占区域；其余画面须与参考在主体、背景、光色、材质上保持同一张成稿的连续性，禁止整图重绘、禁止换滤镜调色、禁止改透视或改主体造型。\n\n" +
        prompt;
    }

    const nanoResult = await generateNanoImage({
      prompt,
      width,
      height,
      quality: "2k",
      referenceImages: [ref],
    });

    const imageUrl = await tryNormalizeRemoteImageToLayoutPixels(
      nanoResult.imageUrl,
      width,
      height
    );

    return NextResponse.json({
      prompt,
      imageUrl,
      width,
      height,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to regenerate KV image";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
