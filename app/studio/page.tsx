"use client";

import dynamic from "next/dynamic";

const StudioCanvas = dynamic(
  () => import("@/components/studio/StudioCanvas").then((m) => m.StudioCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        加载画布…
      </div>
    ),
  }
);

export default function StudioPage() {
  return <StudioCanvas />;
}
