import { dashboardApi } from '@/lib/api/dashboard';
import { decodeBinaryPlotDataInWorker } from '@/lib/utils/decode-worker-client';
import type { BinaryCurveData } from '@/lib/utils/binary-decoder';
import type { SVGPlotCurvesData } from '@/types/api';

const EMPTY_POINTS: SVGPlotCurvesData['curves'][number]['points'] = [];

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return 'Failed to fetch plot data';
}

export function toSVGPlotCurvesData(curves: BinaryCurveData[]): SVGPlotCurvesData {
  return {
    curves: curves.map((curve) => ({
      event_id: curve.eventId,
      points: EMPTY_POINTS,
      x_array: curve.xArray,
      y_array: curve.yArray,
    })),
    x_label: '',
    y_label: '',
    x_unit: '',
    y_unit: '',
  };
}

export async function fetchAndDecodePlot(
  eventIds: string[],
  plotKey: string,
  signal?: AbortSignal,
): Promise<SVGPlotCurvesData> {
  const buffer = await dashboardApi.getSVGPlotDataBinary(
    { event_ids: eventIds, plot_keys: [plotKey] },
    { signal },
  );
  if (signal?.aborted) {
    throw new DOMException('Fetch aborted', 'AbortError');
  }
  const grouped = await decodeBinaryPlotDataInWorker(buffer, { signal });
  if (signal?.aborted) {
    throw new DOMException('Decode aborted', 'AbortError');
  }
  return toSVGPlotCurvesData(grouped.get(plotKey) ?? []);
}
