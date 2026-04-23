import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

/** 与画布节点实际占位大致一致，偏小会导致 Dagre 层间距不足、节点视觉上重叠 */
const DIM = {
  prompt: { w: 320, h: 120 },
  direction: { w: 240, h: 180 },
  kvResult: { w: 280, h: 520 },
  promoCopy: { w: 280, h: 300 },
  promoBanner: { w: 280, h: 400 },
};

function nodeSize(node: Node) {
  switch (node.type) {
    case "direction":
      return DIM.direction;
    case "kvResult":
      return DIM.kvResult;
    case "promoCopy":
      return DIM.promoCopy;
    case "promoBanner":
      return DIM.promoBanner;
    default:
      return DIM.prompt;
  }
}

/** Dagre 分层布局，返回带 position 的 nodes */
export function layoutStudioNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 56,
    ranksep: 120,
    marginx: 32,
    marginy: 32,
  });

  nodes.forEach((node) => {
    const { w, h } = nodeSize(node);
    g.setNode(node.id, { width: w, height: h });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const { w, h } = nodeSize(node);
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });
}
