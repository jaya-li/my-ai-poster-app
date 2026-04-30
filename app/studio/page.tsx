import { redirect } from "next/navigation";

/** 旧路径 /studio 与首页画布合并，保留重定向避免收藏夹失效 */
export default function StudioPage() {
  redirect("/");
}
