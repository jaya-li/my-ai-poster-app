import { promises as fs } from "fs";
import path from "path";
import type { NanoReferenceImage } from "@/lib/nanobanana";

/** 内置推广 Banner 构图参考（图2），放在 public 目录，由设计稿替换 */
export const PROMO_LAYOUT_REF_FILE = "promo-layout-ref.png";

export async function loadBuiltinBannerLayoutRef(): Promise<NanoReferenceImage> {
  const filePath = path.join(process.cwd(), "public", PROMO_LAYOUT_REF_FILE);
  const buf = await fs.readFile(filePath);
  return {
    name: "banner_layout",
    base64: buf.toString("base64"),
    mimeType: "image/png",
  };
}
