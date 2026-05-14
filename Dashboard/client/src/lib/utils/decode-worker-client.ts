import {
  decodeBinaryPlotData,
  groupCurvesByPlotKey,
  type BinaryCurveData,
} from './binary-decoder';

interface DecodeWorkerSuccessResponse {
  id: number;
  ok: true;
  plots: Record<string, BinaryCurveData[]>;
}

interface DecodeWorkerErrorResponse {
  id: number;
  ok: false;
  error: string;
}

type DecodeWorkerResponse = DecodeWorkerSuccessResponse | DecodeWorkerErrorResponse;

interface PendingRequest {
  buffer: ArrayBuffer;
  resolve: (value: Map<string, BinaryCurveData[]>) => void;
  reject: (reason?: unknown) => void;
}

let workerInstance: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

function toAbortError(): Error {
  return new DOMException('Decode aborted', 'AbortError');
}

function decodeOnMainThread(buffer: ArrayBuffer): Map<string, BinaryCurveData[]> {
  return groupCurvesByPlotKey(decodeBinaryPlotData(buffer));
}

function flushWithMainThreadFallback() {
  for (const [id, pending] of pendingRequests.entries()) {
    pendingRequests.delete(id);
    try {
      pending.resolve(decodeOnMainThread(pending.buffer));
    } catch (error) {
      pending.reject(error);
    }
  }
}

function getWorker(): Worker | null {
  if (workerUnavailable) {
    return null;
  }

  if (workerInstance) {
    return workerInstance;
  }

  try {
    workerInstance = new Worker(
      new URL('../../workers/binary-decode.worker.ts', import.meta.url),
      { type: 'module' },
    );
  } catch (error) {
    workerUnavailable = true;
    console.warn('Decode worker unavailable, falling back to main-thread decode.', error);
    return null;
  }

  workerInstance.onmessage = (event: MessageEvent<DecodeWorkerResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    pendingRequests.delete(response.id);
    if (response.ok) {
      pending.resolve(new Map(Object.entries(response.plots)));
      return;
    }

    pending.reject(new Error(response.error));
  };

  workerInstance.onerror = (event) => {
    console.warn('Decode worker failed, switching to main-thread decode fallback.', event.message);
    workerUnavailable = true;
    workerInstance?.terminate();
    workerInstance = null;
    flushWithMainThreadFallback();
  };

  return workerInstance;
}

export function decodeBinaryPlotDataInWorker(
  buffer: ArrayBuffer,
  options?: { signal?: AbortSignal },
): Promise<Map<string, BinaryCurveData[]>> {
  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.reject(toAbortError());
  }

  const worker = getWorker();
  if (!worker) {
    try {
      return Promise.resolve(decodeOnMainThread(buffer));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  const id = ++nextRequestId;

  return new Promise<Map<string, BinaryCurveData[]>>((resolve, reject) => {
    const onAbort = () => {
      pendingRequests.delete(id);
      reject(toAbortError());
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    pendingRequests.set(id, {
      buffer,
      resolve: (value) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        resolve(value);
      },
      reject: (reason) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        reject(reason);
      },
    });

    worker.postMessage({ id, buffer });
  });
}
