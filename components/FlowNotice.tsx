"use client";

type Props = {
  kind: "error" | "info";
  message: string;
  onDismiss: () => void;
};

export function FlowNotice({ kind, message, onDismiss }: Props) {
  const isError = kind === "error";
  return (
    <div
      role="status"
      className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${
        isError
          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          : "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      }`}
    >
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
          isError
            ? "text-red-800 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50"
            : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        关闭
      </button>
    </div>
  );
}
