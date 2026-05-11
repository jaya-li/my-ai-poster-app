/**
 * 浏览器内保存 / 复制图片（供客户端组件按钮使用；fetch 支持 http(s) 与 data URL）。
 */

export async function fetchImageBlob(href: string): Promise<Blob> {
  const res = await fetch(href);
  if (!res.ok) {
    throw new Error(`无法加载图片：HTTP ${res.status}`);
  }
  return res.blob();
}

export async function downloadImageHref(href: string, filename: string): Promise<void> {
  const blob = await fetchImageBlob(href);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyImageHrefToClipboard(href: string): Promise<void> {
  if (!navigator.clipboard?.write) {
    throw new Error("当前环境不支持将图片写入剪贴板");
  }
  const blob = await fetchImageBlob(href);
  const mime =
    blob.type && /^image\//.test(blob.type) ? blob.type : "image/png";
  const typed = blob.type ? blob : new Blob([await blob.arrayBuffer()], { type: mime });
  await navigator.clipboard.write([new ClipboardItem({ [mime]: typed })]);
}
