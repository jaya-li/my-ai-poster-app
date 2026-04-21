import type { ResponseInputContent } from "openai/resources/responses/responses";

export function inputText(text: string): ResponseInputContent {
  return { type: "input_text", text };
}

export function inputImage(imageUrl: string): ResponseInputContent {
  return { type: "input_image", image_url: imageUrl, detail: "auto" };
}
