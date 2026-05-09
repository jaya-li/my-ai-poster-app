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
  buildTuijinbiKvInstructionBlock,
  type ChongbangKvSpec,
  type StarCollectKvSpec,
  type WheelKvSpec,
  type TuijinbiKvSpec,
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

const TuijinbiSpecSchema = WheelSpecSchema;

const BodySchema = z.object({
  theme: z.string().min(1),
  selectedOptions: z.array(z.enum(["A", "B", "C", "D"])).min(1),
  optionContents: z.array(OptionSchema).length(4),
  /** 不传 layoutBase64 时使用内置版式；与 campaignType 决定随机池 */
  campaignType: z
    .enum(["scan", "chongbang", "star_collect", "wheel", "tuijinbi", "baiyuan"])
    .optional()
    .default("scan"),
  /** 仅 campaignType=chongbang 时使用；字段均可选 */
  chongbangSpec: ChongbangSpecSchema,
  /** 仅 campaignType=star_collect 时使用；字段均可选 */
  starCollectSpec: StarCollectSpecSchema,
  /** 仅 campaignType=wheel 时使用；字段均可选 */
  wheelSpec: WheelSpecSchema,
  /** 仅 campaignType=tuijinbi 时使用；结构与 wheel 表单一致 */
  tuijinbiSpec: TuijinbiSpecSchema,
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
  tuijinbiSpec?: TuijinbiKvSpec | null;
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
      `【转盘 · 附件顺序务必对齐】本轮生图库的参考图附件顺序为 **版式 → 画风（图2）→ IP（图3）→ 金币**。下文「图2/图3」标签与附件顺序一致；**不要**套用「画风在 IP 之后」的旧惯性。\n\n` +
      `【转盘抽奖玩法】若图1 为活动页级母版，下述专用 PE 中关于**结构锁定、转盘扇区数量与分割及指针/中心钮几何不变、只换肤与奖品图、全页单一语言、金币位置保留、IP 不挡转盘**等要求，优先于通用条款里仅针对「二维码营销海报」的表述；**图1 无二维码区时不要虚构二维码**。\n\n` +
      `【图2 / 图3 必须写进成片描述】若用户上传了画风参考（图2）或 IP 参考（图3），你输出的最终生图 prompt 中**禁止**仅用「参考图2/图3」带过；须在正文里分别写出至少 **5 条**可执行的视觉锚点（图2：渲染类型、主色与辅色、冷暖光、笔触/虚实边、环境与木石材质等；图3：**眉眼妆造、鼻嘴形状、体态、服饰裁片与纹样、高光与阴影画法如网点或线宽等**）。若文案主题给出的节庆/语种与两张参考可读出的文化语境冲突，以参考为准统一全页。**禁止「另一只橘猫」式替身。**\n\n` +
      `${KV_PROMPT_SYSTEM}\n\n---\n\n${pe}\n\n---\n\n` +
      `须同时体现：同一套转盘玩法页面结构、主题换肤感、「点击转动随机停格获奖」可读性、指针与扇区关系清楚、统一氛围。\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 各功能区块的几何位置、分区比例与信息层级须对齐。`;
  } else if (params.campaignType === "tuijinbi") {
    const pe = buildTuijinbiKvInstructionBlock(
      params.theme,
      params.selectedOptionText,
      params.tuijinbiSpec
    );
    systemAndTaskBlock =
      `你是广告视觉 Prompt Engineer。我会提供主题、参考图与**推金币（台前落物）**专用 PE。你要输出**一段**可直接给 nanobanana 执行的中文生图 prompt。\n\n` +
      `【推金币 · 附件顺序务必对齐】本轮生图库的参考图附件顺序为 **版式 → 画风（图2）→ IP（图3）→ 金币/代币**。下文「图2/图3」标签与附件顺序一致；**不要**套用「画风在 IP 之后」的旧惯性。\n\n` +
      `【推金币玩法】若图1 为该玩法母版，专用 PE 中关于**3×4 十二格锁定、Hero 大球最近景与堆叠带景深、散落堆叠体、底部三键控制台锁定、顶栏占位、亮色可爱 Q 版三维换肤**等要求优先于通用条款里仅针对「二维码营销海报」的表述（无码勿虚构）；**禁止**把设计标尺、测距数字或画布标注写入成片可读区域。\n\n` +
      `【图2 / 图3 必须写进成片描述】若用户上传了画风参考（图2）或 IP 参考（图3），你输出的最终生图 prompt 中**禁止**仅用「参考图2/图3」带过；须在正文里分别写出至少 **5 条**可执行的视觉锚点（图2：**2D/3D 类型**、主色与辅色、软硬高光形态、虚实边习惯、台面/铬边/哑光塑料等材质明暗分区与环境光；图3：**眉眼妆造、鼻嘴形状、体态比例、服饰裁片与纹样、高光与阴影画法如网点或线宽等**）。若文案主题给出的节庆/语种与两张参考可读出的文化语境冲突，以参考为准统一全页。**禁止「另一只橘猫」式替身。**\n\n` +
      `${KV_PROMPT_SYSTEM}\n\n---\n\n${pe}\n\n---\n\n` +
      `须同时体现：同一套推金币玩法页面骨架、清晰可读的台前掉落/堆积体感、统一氛围。\n\n` +
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 各交互区块几何位置与层级须对齐。`;
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
      `【输出画幅与图1完全一致】${params.layoutWidth}×${params.layoutHeight} 像素；图1 非创作区的位置与分区关系须对齐，见上文图1规则（勿在正文中写测距百分比或标尺数字）。\n\n` +
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
    } else if (params.campaignType === "tuijinbi") {
      layoutHint =
        "图1：版式锁定参考（**推金币 / 台前落物活动页母版**）。须保留：顶栏信息/货币区占位；中部固定 **3×4 共十二格**奖励宫格及外框支架的视觉重心；其下透视台面与成堆散落小球区；单颗大号**前景球形主体（Hero）**须读作最近景占位；底部**左中右三按钮**控制台横条。母版内若有韩文/示例节庆字样仅作占位几何，**成片须按用户主题与参数重填**，勿把母版旧主题当法定市场。占位文案仅示结构须替换为目标语言，勿改格数、阵列关系与三大区域几何。";
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
    const styleHint =
      params.campaignType === "wheel"
        ? "图2：画风与环境母题参考（**转盘强约束**）。从图中读出**建筑/自然/光照/调色盘/材质**，写进最终 prompt；成片背景、木石与金属 UI 饰面、天空与氛围光须与该张**同一套插画画法与色温**；**禁止**在参考明显为某一文化场景时整页换成另一套地域模板。须锁定：2D/3D 类型、边缘虚实、主辅色、冷暖光与高光形状、笔触/颗粒；**禁止**换成另一种渲染体系；不要照搬本图构图。你输出的生图 prompt 正文须写出**至少 5 条**对照图2 的可核验风格锚点，不得仅写「同图2」。"
        : params.campaignType === "tuijinbi"
          ? "图2：画风与环境母题参考（**推金币强约束**）。目标气质为**亮色、可爱 Q 版三维**（软高光、圆滑模型、清晰材质分区）。从图中读出**渲染维度、建筑/展台/渐变背景气质、光照与调色盘、材质颗粒**，写进最终 prompt；成片背景、十二格支架、台面、球体与三键控制台须与该张**同一套 3D 管线与色温**；**禁止**在参考明显为某一文化场景时整页换成另一套地域模板。须锁定：主辅色、冷暖光与高光形状、边缘虚实；**禁止**换成扁平矢量或写实摄影风；不要照搬图2 的具体场景构图。你输出的生图 prompt 正文须写出**至少 5 条**对照图2 的可核验风格锚点，不得仅写「同图2」。"
          : "图2：画风参考（高优先级）。请细读渲染类型、色彩系统、光影与材质画法；成片必须与该画风一致，不要换成另一种美术体系；不要照搬本图构图。";
    content.push(inputText(styleHint));
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
        "图3：IP 角色参考（**用户已上传则必达**）。须与图为**同一角色**而非「同色动物」：逐条复现**五官走向（眉/眼/鼻/嘴）、头身比与耳位、毛色分块与服饰结构、标志性小道具**；**必须**在最终 prompt 中写明图3 的**阴影/材质画法**（如粗线勾边、高光对比、半色调网点、平涂腮红等），**禁止**改成闭眼软萌流水脸或另一套 Q 版比例。转盘玩法中 IP **仅配角装饰**，不得遮挡转盘盘面、中心按钮与指针。正文须列**至少 5 条**可对照图3 的具体外观锚点，不得仅写「参考图3」或泛称。";
    } else if (params.campaignType === "tuijinbi") {
      ipHint =
        "图3：IP 角色参考（**用户已上传则必达**）。须与图为**同一角色**而非「同色动物」：逐条复现**五官走向（眉/眼/鼻/嘴）、头身比与耳位、毛色分块与服饰结构、标志性小道具**；**必须**在最终 prompt 中写明图3 的**阴影/材质画法**（如粗线勾边、高光对比、半色调网点、平涂腮红等），**禁止**改成另一套 Q 版比例。推金币玩法中 IP **仅配角装饰**，**不得遮挡**中部 3×4 十二宫格读数区、不得挡大号前景 Hero 球；可出现于顶栏、角标或小装饰。正文须列**至少 5 条**可对照图3 的具体外观锚点，不得仅写「参考图3」或泛称。";
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
    } else if (params.campaignType === "tuijinbi") {
      coinHint =
        "图4：金币/代币参考。顶栏与小球堆若体现奖励币语义，成片须延续可识别代币造型；可按主题微调色面与纹样，须有实体币质感，禁止平贴图标感。";
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

/** 转盘 Nanobanana 参考顺序为版式→画风→IP→金币，尾部须与 referenceImages 完全一致 */
function buildWheelNanoPromptTail(
  refs: ReadonlyArray<{ name: string }>
): string {
  if (refs.length <= 1) return "";
  const label: Record<string, string> = {
    layout: "版式母版（转盘扇区数与径向分割、中心钮、指针与各 UI 模块占位锁定）",
    style:
      "画风全局参考——成片渲染维度、线条、色彩系统、光影与材质颗粒须与该张一致；转盘外圈质感、背景天空/场景氛围、主按钮高光习惯须服从，禁止换成另一套美术管线",
    ip: "IP 角色参考——须为同一吉祥物/IP（禁止换物种、换脸或另一套配色分区）；仅配角位，严禁遮挡转盘盘面、中心按钮与指针",
    coin: "金币或积分币质感与镶边参考",
  };
  const parts = refs.map((r, i) => `第${i + 1}张${label[r.name] ?? `（${r.name}）`}`);
  return ` 【生图参考图顺序（与本请求实际上传顺序一致）】${parts.join("；")}。`;
}

/** 推金币 Nanobanana 参考顺序为版式→画风→IP→金币，尾部须与 referenceImages 完全一致 */
function buildTuijinbiNanoPromptTail(
  refs: ReadonlyArray<{ name: string }>
): string {
  if (refs.length <= 1) return "";
  const label: Record<string, string> = {
    layout:
      "版式母版（3×4 十二宫格、Hero 大球、堆叠带、底栏三键与各 UI 模块占位锁定）",
    style:
      "画风全局参考——成片 Q 版三维光照、主辅色、边缘光与材质颗粒须与该张一致；格架/台面/球体/按钮的高光习惯须服从，禁止换成另一套美术管线",
    ip: "IP 角色参考——须为同一吉祥物/IP（禁止换物种、换脸或另一套配色分区）；仅配角位，严禁遮挡十二宫格读数区与 Hero 大球",
    coin: "金币或代币质感与镶边参考",
  };
  const parts = refs.map(
    (r, i) => `第${i + 1}张${label[r.name] ?? `（${r.name}）`}`
  );
  return ` 【生图参考图顺序（与本请求实际上传顺序一致）】${parts.join("；")}。`;
}

/** 转盘内置版式筛选（是否采用巴西专版 zhuanpan2）：合并主题与 wheel 表单字段供地域推断 */
function buildWheelLocaleBlob(
  theme: string,
  wheelSpec: z.infer<typeof WheelSpecSchema> | undefined
): string {
  const parts = [theme];
  if (wheelSpec) {
    for (const v of Object.values(wheelSpec)) {
      if (typeof v === "string" && v.trim()) parts.push(v.trim());
    }
  }
  return parts.join("\n");
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
      const builtin = await loadBuiltinKvLayoutDataUrl(campaignType, {
        wheelLocaleBlob:
          campaignType === "wheel"
            ? buildWheelLocaleBlob(parsed.theme, parsed.wheelSpec)
            : undefined,
      });
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

    /**
     * 转盘与推金币：版式 → 画风 → IP → 金币，让生图模型更早锁定全局渲染体系，再锁 IP（与 GPT 侧图2/图3 分工一致）。
     * 其它玩法：版式 → IP → 画风 → 金币（与历史 ipPromptTail 文案一致）。
     */
    const styleBeforeIp =
      campaignType === "wheel" || campaignType === "tuijinbi";
    const referenceImages = styleBeforeIp
      ? ([
          {
            name: "layout",
            base64: layoutBase64Pure,
            mimeType: getImageMimeFromBase64(layoutDataUrl),
          },
          imagesForKv.styleBase64
            ? {
                name: "style",
                base64: stripDataUrlPrefix(imagesForKv.styleBase64),
                mimeType: getImageMimeFromBase64(imagesForKv.styleBase64),
              }
            : null,
          imagesForKv.ipBase64
            ? {
                name: "ip",
                base64: stripDataUrlPrefix(imagesForKv.ipBase64),
                mimeType: getImageMimeFromBase64(imagesForKv.ipBase64),
              }
            : null,
          imagesForKv.coinBase64
            ? {
                name: "coin",
                base64: stripDataUrlPrefix(imagesForKv.coinBase64),
                mimeType: getImageMimeFromBase64(imagesForKv.coinBase64),
              }
            : null,
        ].filter(Boolean) as Array<{ name: string; base64: string; mimeType: string }>)
      : ([
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
        ].filter(Boolean) as Array<{ name: string; base64: string; mimeType: string }>);

    const ipPromptTailByCampaign: Record<
      Exclude<KvCampaignType, "wheel" | "tuijinbi">,
      string
    > = {
      scan:
        " 【参考图顺序】第1张版式锁定；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、场景与和二维码的互动方式可创新。",
      chongbang:
        " 【参考图顺序】第1张版式锁定（冲榜母版）；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、场景与主视觉/榜单预留区的互动方式可创新。",
      star_collect:
        " 【参考图顺序】第1张版式锁定（星星收集活动页母版）；第2张为 IP 角色形象锁定，成片主角色必须与该张在物种类别、毛色与花纹分区、服装与头饰配色及纹样、头身比与五官画风上为同一角色，禁止换成其他吉祥物或另一套配色体系；其后为画风与金币装饰参考（若有）。仅姿势、场景与主视觉收集区/容器叙事的互动方式可创新；IP 不得抢夺收集物与容器焦点。",
      baiyuan:
        " 【参考图顺序】第1张百元/App 大促 KV 版式锁定；第2张为 IP 双角色形象锁定，成片须为同一 IP 体系下的主题化双角色（右主左辅），紧密围合中央大奖；其后为画风与金币/奖励材质参考（若有）。背景须为纯白摄影棚、中央奖励容器与图4 金币须集中融合，禁止杂乱漂浮物。",
    };
    const nanoRefOrderTail =
      campaignType === "wheel"
        ? buildWheelNanoPromptTail(referenceImages)
        : campaignType === "tuijinbi"
          ? buildTuijinbiNanoPromptTail(referenceImages)
          : imagesForKv.ipBase64
            ? ipPromptTailByCampaign[campaignType]
            : "";

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
        tuijinbiSpec: campaignType === "tuijinbi" ? parsed.tuijinbiSpec : undefined,
        images: imagesForKv,
      });
      if (nanoRefOrderTail) {
        prompt = prompt.trim() + nanoRefOrderTail;
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
