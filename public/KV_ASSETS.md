# `public/` 下的主视觉与相关图片清单

> 以仓库内实际文件为准（非对话记忆）。代码中的玩法池见 `lib/kv-layout-builtin.ts`，拆图/去 UI 见 `app/api/regenerate-kv-image/route.ts`、`lib/kv-split-reference.ts`。

## 一、各玩法内置版式母版（图 1）

每次生成主视觉时，在未上传自定义版式的条件下，会从对应池中 **随机抽 1 张**当作图 1。

| 玩法 (`campaignType`) | 文件名 |
|----------------------|--------|
| 扫码 `scan` | `kv-layout-scan1.png`、`kv-layout-scan2.png`、`kv-layout-scan3.png` |
| 冲榜 `chongbang` | `kv-layout-chongbang1.png`、`kv-layout-chongbang2.png`、`kv-layout-chongbang3.png` |
| 星星收集 `star_collect` | `kv-layout-xingxing1.png`、`kv-layout-xingxing2.png`、`kv-layout-xingxing3.png` |
| 转盘 `wheel` | `kv-layout-zhuanpan1.png`、`kv-layout-zhuanpan2.png`、`kv-layout-zhuanpan3.png` · 说明：`zhuanpan2` 为巴西语境母版，非巴西语境时通常只在 `zhuanpan1` / `zhuanpan3` 中随机（见代码 `pickWheelBuiltinLayoutFilenameForContext`） |
| 推金币 `tuijinbi` | `kv-tuijinbi-1.png`、`kv-tuijinbi-2.png`、`kv-tuijinbi-3.png`、`kv-tuijinbi-4.png` · **说明**：四张为已对齐的版式参考，**纵向分区相同**（顶栏 → 奖格板 → 台前推币区 → 底栏主钮+左右圆钮），仅换主题皮肤；**奖格行列数可能不同**：当前母版多为 `-1` **3×4（12 格）**，`-2`/`-3`/`-4` **4×4（16 格）**，生图与 prompt 均以**当次随机到的图 1**为准数格，禁止套错。 |
| 百元 `baiyuan` | `kv-layout-baiyuan1.png`、`kv-layout-baiyuan2.png`、`kv-layout-baiyuan3.png` |

## 二、「去 UI」参考（仅 API 可选用，不参与默认随机）

| 文件名 | 用途简述 |
|--------|----------|
| `saoma-quchuui.png` | 扫码玩法去 UI 参考示例 |
| `chongbang-quchuui.png` | 冲榜 |
| `xingxing-quchuui.png` | 星星收集 |
| `zhuanpan-quchuui.png` | 转盘 |
| `tuijinbi-quchuui.png` | 推金币（若缺失则该行功能降级） |
| `baiyuan-quchuui.png` | 百元 |

## 三、拆图分层参考（`lib/kv-split-reference.ts`）

| 文件名 | 关联玩法 |
|--------|----------|
| `saoma-chaitu.png` | `scan` |
| `chongbang-chaitu.png` | `chongbang` |
| `chaitu-zhuanpan.png` | `wheel` |
| `chaitu-tuijinbi.png` | `tuijinbi` |

星星收集、百元若无拆图参考配置则以文本规则为准（见 API 代码）。

## 四、代码引用但仓库中暂无的文件

| 文件名 | 说明 |
|--------|------|
| `promo-layout-ref.png` | 推广横版 Banner 的图 2 母版，`lib/banner-layout.ts` 会读取；**当前仓库 public 目录下未检出**，需要推广图功能时请自行添加同路径文件。 |

## 五、其它静态资源（与 KV 玩法无直接耦合）

| 文件名 |
|--------|
| `file.svg`、`vercel.svg`、`window.svg` |

---

**维护说明**：新增或删减 `kv-layout-*.png` / `kv-tuijinbi-*.png` 后，务必同步修改 `lib/kv-layout-builtin.ts` 中对应数组，并更新本文件。
