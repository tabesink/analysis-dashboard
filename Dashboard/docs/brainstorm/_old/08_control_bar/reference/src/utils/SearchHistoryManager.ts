type HistoryItem = {
  label: string;
  timestamp: number;
};

const STORAGE_KEY = "lightrag-graph-label-history";
const MAX_HISTORY = 30;

export const SearchHistoryManager = {
  getHistory(): HistoryItem[] {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isHistoryItem);
    } catch {
      return [];
    }
  },

  getHistoryLabels(limit: number): string[] {
    return this.getHistory()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map((item) => item.label);
  },

  addToHistory(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const next = [
      { label: trimmed, timestamp: Date.now() },
      ...this.getHistory().filter((item) => item.label !== trimmed),
    ].slice(0, MAX_HISTORY);
    save(next);
  },

  clearHistory() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  async initializeWithDefaults(labels: string[]) {
    if (this.getHistory().length > 0) return;
    save(labels.slice(0, MAX_HISTORY).map((label, index) => ({ label, timestamp: Date.now() - index })));
  },
};

function save(items: HistoryItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

function isHistoryItem(value: unknown): value is HistoryItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "label" in value &&
    typeof value.label === "string" &&
    "timestamp" in value &&
    typeof value.timestamp === "number"
  );
}
