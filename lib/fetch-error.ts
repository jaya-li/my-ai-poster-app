/** 把 Node/undici 的「fetch failed」展开成可读说明，便于排查网络问题 */
export function explainFetchFailure(context: string, error: unknown): string {
  if (error instanceof Error) {
    const anyErr = error as Error & { cause?: unknown };
    const cause = anyErr.cause;
    let causePart = "";
    if (cause instanceof Error) {
      causePart = cause.message;
    } else if (typeof cause === "object" && cause !== null) {
      const c = cause as Record<string, unknown>;
      const code = c.code != null ? String(c.code) : "";
      const syscall = c.syscall != null ? String(c.syscall) : "";
      const hostname = c.hostname != null ? String(c.hostname) : "";
      const parts = [code, syscall, hostname].filter(Boolean);
      if (parts.length) causePart = parts.join(" ");
    } else if (cause != null) {
      causePart = String(cause);
    }
    const detail = causePart ? ` 原因：${causePart}` : "";
    return `${context}：${error.message}.${detail}`;
  }
  return `${context}：${String(error)}`;
}
