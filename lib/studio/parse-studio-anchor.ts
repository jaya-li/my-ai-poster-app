import type { DirKey } from "@/components/studio/types";

export type ParsedStudioAnchor =
  | { kind: "prompt"; threadId: string }
  | { kind: "direction"; threadId: string; dirKey: DirKey }
  | { kind: "kv"; threadId: string; dirKey: DirKey }
  | { kind: "copy"; threadId: string; dirKey: DirKey }
  | { kind: "banner"; threadId: string; dirKey: DirKey };

const DIR_KEY_RE = /^[ABCD]$/;

export function parseStudioAnchor(anchorId: string): ParsedStudioAnchor | null {
  if (anchorId.startsWith("prompt-")) {
    return { kind: "prompt", threadId: anchorId.slice("prompt-".length) };
  }
  {
    const m = anchorId.match(/^dir-(.+)-([ABCD])$/);
    if (m && DIR_KEY_RE.test(m[2])) {
      return { kind: "direction", threadId: m[1], dirKey: m[2] as DirKey };
    }
  }
  {
    const m = anchorId.match(/^kv-(.+)-([ABCD])$/);
    if (m && DIR_KEY_RE.test(m[2])) {
      return { kind: "kv", threadId: m[1], dirKey: m[2] as DirKey };
    }
  }
  {
    const m = anchorId.match(/^copy-(.+)-([ABCD])$/);
    if (m && DIR_KEY_RE.test(m[2])) {
      return { kind: "copy", threadId: m[1], dirKey: m[2] as DirKey };
    }
  }
  {
    const m = anchorId.match(/^banner-(.+)-([ABCD])$/);
    if (m && DIR_KEY_RE.test(m[2])) {
      return { kind: "banner", threadId: m[1], dirKey: m[2] as DirKey };
    }
  }
  return null;
}

/** @deprecated 仅兼容旧逻辑命名；新节点 id 请用 parseStudioAnchor */
export function dirKeyFromStudioNodeId(anchorId: string): DirKey | null {
  const p = parseStudioAnchor(anchorId);
  if (!p || p.kind === "prompt") return null;
  return p.dirKey;
}
