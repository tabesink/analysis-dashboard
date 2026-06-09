export const DEFAULT_NODE_COLOR = "#005F73";

const PROMPT_TYPE_PALETTE = [
  "#001219",
  "#005F73",
  "#0A9396",
  "#94D2BD",
  "#E9D8A6",
  "#EE9B00",
  "#CA6702",
  "#BB3E03",
  "#AE2012",
  "#9B2226",
];

const EXTENDED_COLORS = [
  "#9B2226",
  "#AE2012",
  "#BB3E03",
  "#CA6702",
  "#EE9B00",
  "#E9D8A6",
  "#94D2BD",
  "#0A9396",
  "#005F73",
  "#001219",
];

let promptTypeColorMap = new Map<string, string>();

export function configurePromptEntityTypes(entityTypes: string[]) {
  const nextMap = new Map<string, string>();
  entityTypes.map(normalizeNodeType).filter(Boolean).forEach((entityType, index) => {
    nextMap.set(entityType, PROMPT_TYPE_PALETTE[index % PROMPT_TYPE_PALETTE.length]);
  });
  promptTypeColorMap = nextMap;
  return nextMap;
}

export function resolveNodeColor(
  nodeType: string | undefined,
  currentMap: Map<string, string> | undefined,
): { color: string; map: Map<string, string>; updated: boolean; type: string } {
  const typeColorMap = currentMap ?? new Map<string, string>();
  const normalizedType = normalizeNodeType(nodeType);

  if (typeColorMap.has(normalizedType)) {
    return {
      color: typeColorMap.get(normalizedType) || DEFAULT_NODE_COLOR,
      map: typeColorMap,
      updated: false,
      type: normalizedType,
    };
  }

  const promptColor = promptTypeColorMap.get(normalizedType);
  if (promptColor) {
    const map = new Map(typeColorMap);
    map.set(normalizedType, promptColor);
    return { color: promptColor, map, updated: true, type: normalizedType };
  }

  const usedExtendedColors = new Set(Array.from(typeColorMap.values()).filter((color) => EXTENDED_COLORS.includes(color)));
  const color = normalizedType === "unknown" ? DEFAULT_NODE_COLOR : EXTENDED_COLORS.find((candidate) => !usedExtendedColors.has(candidate)) || DEFAULT_NODE_COLOR;
  const map = new Map(typeColorMap);
  map.set(normalizedType, color);
  return { color, map, updated: true, type: normalizedType };
}

export function normalizeNodeType(nodeType: string | undefined) {
  const normalized = nodeType?.trim().toLowerCase();
  return normalized || "unknown";
}
