export type LayoutNode = { id: string };
export type LayoutEdge = { source: string; target: string };

export function buildVisualizationLayout(nodes: LayoutNode[]) {
  return {
    positions: buildRandomPositions(nodes),
  };
}

function buildRandomPositions(nodes: LayoutNode[]) {
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node) => {
    positions[node.id] = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
  });

  return positions;
}
