import type { ResponseInputContent } from "openai/resources/responses/responses";

export function inputText(text: string): ResponseInputContent {
  return { type: "input_text", text };
}

export function inputImage(imageUrl: string): ResponseInputContent {
  return { type: "input_image", image_url: imageUrl, detail: "auto" };
}

/** 画风/IP 等需要细读材质与轮廓时使用 */
export function inputImageHigh(imageUrl: string): ResponseInputContent {
  return { type: "input_image", image_url: imageUrl, detail: "high" };
}
