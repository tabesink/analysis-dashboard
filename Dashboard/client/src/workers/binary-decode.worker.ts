interface DecodeWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
}

interface BinaryCurveData {
  eventId: string;
  plotKey: string;
  xArray: Float32Array;
  yArray: Float32Array;
}

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

const textDecoder = new TextDecoder();

function readFloat32Array(
  view: DataView,
  buffer: ArrayBuffer,
  offset: number,
  length: number,
): { values: Float32Array; nextOffset: number } {
  const byteLength = length * 4;
  const nextOffset = offset + byteLength;

  if (offset % 4 === 0) {
    return {
      values: new Float32Array(buffer, offset, length),
      nextOffset,
    };
  }

  const values = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    values[i] = view.getFloat32(offset + i * 4, true);
  }
  return { values, nextOffset };
}

function decodeBinaryPlotData(buffer: ArrayBuffer): BinaryCurveData[] {
  const view = new DataView(buffer);
  let offset = 0;
  const numCurves = view.getUint32(offset, true);
  offset += 4;

  const curves: BinaryCurveData[] = [];
  for (let i = 0; i < numCurves; i++) {
    const eventIdLen = view.getUint16(offset, true);
    offset += 2;
    const eventId = textDecoder.decode(new Uint8Array(buffer, offset, eventIdLen));
    offset += eventIdLen;

    const plotKeyLen = view.getUint16(offset, true);
    offset += 2;
    const plotKey = textDecoder.decode(new Uint8Array(buffer, offset, plotKeyLen));
    offset += plotKeyLen;

    const numPoints = view.getUint32(offset, true);
    offset += 4;

    const xResult = readFloat32Array(view, buffer, offset, numPoints);
    offset = xResult.nextOffset;
    const yResult = readFloat32Array(view, buffer, offset, numPoints);
    offset = yResult.nextOffset;

    curves.push({
      eventId,
      plotKey,
      xArray: xResult.values,
      yArray: yResult.values,
    });
  }

  return curves;
}

function toGroupedRecord(curves: BinaryCurveData[]): Record<string, BinaryCurveData[]> {
  const grouped = new Map<string, BinaryCurveData[]>();
  for (const curve of curves) {
    const existing = grouped.get(curve.plotKey);
    if (existing) {
      existing.push(curve);
    } else {
      grouped.set(curve.plotKey, [curve]);
    }
  }
  const record: Record<string, BinaryCurveData[]> = {};
  for (const [plotKey, plotCurves] of grouped.entries()) {
    record[plotKey] = plotCurves;
  }
  return record;
}

self.onmessage = (event: MessageEvent<DecodeWorkerRequest>) => {
  const { id, buffer } = event.data;

  try {
    const decoded = decodeBinaryPlotData(buffer);
    const response: DecodeWorkerResponse = {
      id,
      ok: true,
      plots: toGroupedRecord(decoded),
    };
    self.postMessage(response);
  } catch (error) {
    const response: DecodeWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Binary decode failed',
    };
    self.postMessage(response);
  }
};
