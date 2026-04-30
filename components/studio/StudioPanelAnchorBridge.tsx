"use client";

import { useLayoutEffect } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

export type StudioPanelAnchorPayload = {
  /** 节点右缘中点（视口坐标），用于在右侧接出引导线 */
  anchorOnNode: { x: number; y: number };
  /** 节点外接矩形（视口坐标），用于另一侧贴靠 */
  nodeBounds: { left: number; top: number; right: number; bottom: number };
};

type StudioPanelAnchorBridgeProps = {
  nodeId: string | null;
  enabled: boolean;
  onPayload: (p: StudioPanelAnchorPayload | null) => void;
};

/**
 * 必须在 `<ReactFlow>` 子树内渲染，用内部节点坐标与 transform 计算节点在视口中的位置。
 */
export function StudioPanelAnchorBridge({ nodeId, enabled, onPayload }: StudioPanelAnchorBridgeProps) {
  const { getInternalNode } = useReactFlow();
  const transform = useStore((s) => s.transform);
  const domNode = useStore((s) => s.domNode);

  useLayoutEffect(() => {
    if (!enabled || !nodeId || !domNode) {
      onPayload(null);
      return;
    }
    const internal = getInternalNode(nodeId);
    if (!internal) {
      onPayload(null);
      return;
    }
    const cr = domNode.getBoundingClientRect();
    const [tx, ty, zoom] = transform;
    const { x: ax, y: ay } = internal.internals.positionAbsolute;
    const w = internal.measured.width ?? internal.width ?? 260;
    const h = internal.measured.height ?? internal.height ?? 140;

    const toClient = (fx: number, fy: number) => ({
      x: cr.left + fx * zoom + tx,
      y: cr.top + fy * zoom + ty,
    });

    const tl = toClient(ax, ay);
    const tr = toClient(ax + w, ay);
    const br = toClient(ax + w, ay + h);
    const bl = toClient(ax, ay + h);

    const nodeRight = tr.x;
    const nodeMidY = (tl.y + bl.y) / 2;

    onPayload({
      anchorOnNode: { x: nodeRight, y: nodeMidY },
      nodeBounds: { left: tl.x, top: tl.y, right: br.x, bottom: br.y },
    });
  }, [enabled, nodeId, domNode, transform, getInternalNode, onPayload]);

  return null;
}
