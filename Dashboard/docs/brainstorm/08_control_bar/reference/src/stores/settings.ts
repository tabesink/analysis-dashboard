import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { defaultQueryLabel } from "@/lib/constants";
import { createSelectors } from "@/lib/utils";
import type { Message, QueryRequest } from "@/api/lightrag";

type Theme = "dark" | "light" | "system";

type SettingsState = {
  showPropertyPanel: boolean;
  showLegend: boolean;
  showNodeLabel: boolean;
  enableNodeDrag: boolean;
  showEdgeLabel: boolean;
  enableHideUnselectedEdges: boolean;
  enableEdgeEvents: boolean;
  minEdgeSize: number;
  maxEdgeSize: number;
  graphQueryMaxDepth: number;
  graphMaxNodes: number;
  backendMaxGraphNodes: number | null;
  graphLayoutMaxIterations: number;
  queryLabel: string;
  retrievalHistory: Message[];
  querySettings: Omit<QueryRequest, "query">;
  theme: Theme;
  searchLabelDropdownRefreshTrigger: number;
  setShowLegend: (show: boolean) => void;
  setMinEdgeSize: (size: number) => void;
  setMaxEdgeSize: (size: number) => void;
  setGraphQueryMaxDepth: (depth: number) => void;
  setGraphMaxNodes: (nodes: number, triggerRefresh?: boolean) => void;
  setBackendMaxGraphNodes: (maxNodes: number | null) => void;
  setGraphLayoutMaxIterations: (iterations: number) => void;
  setQueryLabel: (queryLabel: string) => void;
  setRetrievalHistory: (history: Message[]) => void;
  updateQuerySettings: (settings: Partial<QueryRequest>) => void;
  setTheme: (theme: Theme) => void;
  triggerSearchLabelDropdownRefresh: () => void;
  setShowPropertyPanel: (show: boolean) => void;
  setShowNodeLabel: (show: boolean) => void;
  setEnableNodeDrag: (enable: boolean) => void;
  setShowEdgeLabel: (show: boolean) => void;
  setEnableHideUnselectedEdges: (enable: boolean) => void;
  setEnableEdgeEvents: (enable: boolean) => void;
};

const useSettingsStoreBase = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      showPropertyPanel: true,
      showLegend: false,
      showNodeLabel: true,
      enableNodeDrag: true,
      showEdgeLabel: false,
      enableHideUnselectedEdges: true,
      enableEdgeEvents: false,
      minEdgeSize: 1,
      maxEdgeSize: 1,
      graphQueryMaxDepth: 3,
      graphMaxNodes: 1000,
      backendMaxGraphNodes: null,
      graphLayoutMaxIterations: 15,
      queryLabel: defaultQueryLabel,
      retrievalHistory: [],
      querySettings: {
        mode: "global",
        top_k: 40,
        chunk_top_k: 20,
        max_entity_tokens: 6000,
        max_relation_tokens: 8000,
        max_total_tokens: 30000,
        only_need_context: false,
        only_need_prompt: false,
        stream: true,
        history_turns: 0,
        user_prompt: "",
        enable_rerank: true,
      },
      searchLabelDropdownRefreshTrigger: 0,
      setTheme: (theme) => set({ theme }),
      setQueryLabel: (queryLabel) => set({ queryLabel }),
      setGraphQueryMaxDepth: (graphQueryMaxDepth) => set({ graphQueryMaxDepth }),
      setGraphMaxNodes: (graphMaxNodes, triggerRefresh = false) => {
        if (!triggerRefresh) {
          set({ graphMaxNodes });
          return;
        }
        set((state) => ({ graphMaxNodes, queryLabel: state.queryLabel ? "" : defaultQueryLabel }));
        setTimeout(() => set((state) => ({ queryLabel: state.queryLabel || defaultQueryLabel })), 150);
      },
      setBackendMaxGraphNodes: (backendMaxGraphNodes) => set({ backendMaxGraphNodes }),
      setGraphLayoutMaxIterations: (graphLayoutMaxIterations) => set({ graphLayoutMaxIterations }),
      setMinEdgeSize: (minEdgeSize) => set({ minEdgeSize }),
      setMaxEdgeSize: (maxEdgeSize) => set({ maxEdgeSize }),
      setShowLegend: (showLegend) => set({ showLegend }),
      setRetrievalHistory: (retrievalHistory) => set({ retrievalHistory }),
      updateQuerySettings: (settings) =>
        set((state) => ({
          querySettings: { ...state.querySettings, ...settings, history_turns: 0 },
        })),
      triggerSearchLabelDropdownRefresh: () =>
        set((state) => ({
          searchLabelDropdownRefreshTrigger: state.searchLabelDropdownRefreshTrigger + 1,
        })),
      setShowPropertyPanel: (showPropertyPanel) => set({ showPropertyPanel }),
      setShowNodeLabel: (showNodeLabel) => set({ showNodeLabel }),
      setEnableNodeDrag: (enableNodeDrag) => set({ enableNodeDrag }),
      setShowEdgeLabel: (showEdgeLabel) => set({ showEdgeLabel }),
      setEnableHideUnselectedEdges: (enableHideUnselectedEdges) => set({ enableHideUnselectedEdges }),
      setEnableEdgeEvents: (enableEdgeEvents) => set({ enableEdgeEvents }),
    }),
    {
      name: "graph-settings-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        showPropertyPanel: state.showPropertyPanel,
        showLegend: state.showLegend,
        showNodeLabel: state.showNodeLabel,
        enableNodeDrag: state.enableNodeDrag,
        showEdgeLabel: state.showEdgeLabel,
        enableHideUnselectedEdges: state.enableHideUnselectedEdges,
        enableEdgeEvents: state.enableEdgeEvents,
        minEdgeSize: state.minEdgeSize,
        maxEdgeSize: state.maxEdgeSize,
        graphQueryMaxDepth: state.graphQueryMaxDepth,
        graphMaxNodes: state.graphMaxNodes,
        graphLayoutMaxIterations: state.graphLayoutMaxIterations,
        queryLabel: state.queryLabel,
      }),
    },
  ),
);

export const useSettingsStore = createSelectors(useSettingsStoreBase);
