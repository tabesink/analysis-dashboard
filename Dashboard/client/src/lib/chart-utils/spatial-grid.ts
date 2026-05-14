/**
 * Spatial Grid - O(1) hit detection for canvas plots
 * 
 * Single Responsibility: Indexes 2D points into a grid for fast spatial lookups
 */

export interface GridItem {
  id: string;
  path?: { x: number; y: number }[];
  xPath?: Float32Array;
  yPath?: Float32Array;
}

export interface SpatialGridConfig {
  cellSize: number;
}

const DEFAULT_CELL_SIZE = 20;
const DEFAULT_HIT_THRESHOLD = 15;

const DEFAULT_CONFIG: SpatialGridConfig = {
  cellSize: DEFAULT_CELL_SIZE,
};

/**
 * Builds a spatial grid from items with paths
 * Each item is indexed in all cells its path passes through
 */
export function buildSpatialGrid<T extends GridItem>(
  items: T[],
  config: SpatialGridConfig = DEFAULT_CONFIG
): Map<string, T[]> {
  const { cellSize } = config;
  const grid = new Map<string, T[]>();

  for (const item of items) {
    const visitedCells = new Set<string>();
    const xArr = item.xPath;
    const yArr = item.yPath;
    const points = item.path;
    const len = xArr && yArr ? Math.min(xArr.length, yArr.length) : (points?.length ?? 0);

    for (let i = 0; i < len; i++) {
      const px = xArr ? xArr[i] : points![i].x;
      const py = yArr ? yArr[i] : points![i].y;
      const cellX = Math.floor(px / cellSize);
      const cellY = Math.floor(py / cellSize);
      const key = `${cellX},${cellY}`;

      if (!visitedCells.has(key)) {
        visitedCells.add(key);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(item);
      }
    }
  }

  return grid;
}

/**
 * Finds candidate items near a point using the spatial grid
 * Checks the cell containing the point plus 8 neighbors
 */
export function findCandidates<T extends GridItem>(
  grid: Map<string, T[]>,
  x: number,
  y: number,
  cellSize: number = DEFAULT_CONFIG.cellSize,
  reuse?: Set<T>
): Set<T> {
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  const candidates = reuse ?? new Set<T>();
  if (reuse) reuse.clear();

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nearby = grid.get(`${cellX + dx},${cellY + dy}`);
      if (nearby) nearby.forEach((item) => candidates.add(item));
    }
  }

  return candidates;
}

/**
 * Finds the nearest item to a point from a set of candidates
 * Returns null if no item is within the threshold distance
 */
export function findNearest<T extends GridItem>(
  candidates: Set<T>,
  x: number,
  y: number,
  threshold: number = DEFAULT_HIT_THRESHOLD
): T | null {
  let nearest: T | null = null;
  let minDistSq = threshold * threshold;

  for (const item of candidates) {
    const xArr = item.xPath;
    const yArr = item.yPath;
    const points = item.path;
    const len = xArr && yArr ? Math.min(xArr.length, yArr.length) : (points?.length ?? 0);

    for (let i = 0; i < len; i++) {
      const dx = (xArr ? xArr[i] : points![i].x) - x;
      const dy = (yArr ? yArr[i] : points![i].y) - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = item;
      }
    }
  }

  return nearest;
}
