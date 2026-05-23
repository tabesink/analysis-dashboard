import { create } from "zustand";
import { createSelectors } from "@/lib/utils";

type BackendState = {
  pipelineBusy: boolean;
  errorMessage: string | null;
  errorTitle: string | null;
  setPipelineBusy: (busy: boolean) => void;
  setErrorMessage: (message: string | null, title?: string | null) => void;
};

const useBackendStateBase = create<BackendState>()((set) => ({
  pipelineBusy: false,
  errorMessage: null,
  errorTitle: null,
  setPipelineBusy: (pipelineBusy) => set({ pipelineBusy }),
  setErrorMessage: (errorMessage, errorTitle = null) => set({ errorMessage, errorTitle }),
}));

export const useBackendState = createSelectors(useBackendStateBase);
