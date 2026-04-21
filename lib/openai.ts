/**
 * OpenAI：请在项目根目录 `.env.local` 填写 `OPENAI_API_KEY`（勿提交仓库）。
 * 部署时在 Vercel Environment Variables 中配置同名变量。
 */
import OpenAI from "openai";

/** @see `.env.local` → `OPENAI_API_KEY` ← 用户在此填写 */
const key = process.env.OPENAI_API_KEY?.trim();

/** 构建阶段可能没有 env；占位符仅用于通过 SDK 构造，实际请求前路由会校验真实 Key */
export const openai = new OpenAI({
  apiKey: key && key.length > 0 ? key : "sk-build-time-placeholder",
});

/** 默认使用 gpt-4o；可在 Vercel / .env.local 设置 OPENAI_MODEL=gpt-5.4 等 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o";
}
