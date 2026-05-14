#!/usr/bin/env node

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.MEM_BENCH_BASE_URL ?? 'http://localhost:3001';
const API_URL = process.env.MEM_BENCH_API_URL ?? 'http://localhost:8000';
const DASHBOARD_PATH = process.env.MEM_BENCH_PATH ?? '/dashboard';
const CYCLES = Number.parseInt(process.env.MEM_BENCH_CYCLES ?? '8', 10);
const SETTLE_MS = Number.parseInt(process.env.MEM_BENCH_SETTLE_MS ?? '9000', 10);
const OUTPUT_DIR = process.env.MEM_BENCH_OUTPUT_DIR ?? 'memory-benchmarks';
const SESSION_STORAGE_KEY = 'rsp_session_id';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readMetrics(page, cdpSession, label) {
  const perfMetrics = await cdpSession.send('Performance.getMetrics');
  const metricMap = new Map(perfMetrics.metrics.map((m) => [m.name, m.value]));

  const domStats = await cdpSession.send('Memory.getDOMCounters');
  const browserHeap = await page.evaluate(() => {
    const memory = performance.memory;
    if (!memory) {
      return null;
    }
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  });

  const renderStats = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="aspect-4/3"]').length;
    const svgPaths = document.querySelectorAll('path').length;
    const canvases = document.querySelectorAll('canvas').length;
    const treeRows = document.querySelectorAll('[data-event-id]').length;
    return { cards, svgPaths, canvases, treeRows };
  });

  return {
    label,
    timestamp: new Date().toISOString(),
    heapUsedBytes:
      browserHeap?.usedJSHeapSize ??
      (metricMap.get('JSHeapUsedSize') ? Math.round(metricMap.get('JSHeapUsedSize')) : null),
    heapTotalBytes:
      browserHeap?.totalJSHeapSize ??
      (metricMap.get('JSHeapTotalSize') ? Math.round(metricMap.get('JSHeapTotalSize')) : null),
    heapLimitBytes: browserHeap?.jsHeapSizeLimit ?? null,
    nodes: domStats.nodes,
    documents: domStats.documents,
    jsEventListeners: domStats.jsEventListeners,
    renderStats,
  };
}

async function clickIfVisible(locator) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

async function ensureSelections(page) {
  const allButtons = page.getByRole('button', { name: /^All$/ });
  const allCount = await allButtons.count();

  if (allCount > 0) {
    for (let i = 0; i < allCount; i++) {
      const button = allButtons.nth(i);
      await clickIfVisible(button);
      await sleep(150);
    }
  }

  // Fallback when "All" controls are not enough (or no events are selected):
  // explicitly toggle checkboxes in the tree until Render is enabled.
  const renderButton = page.getByRole('button', { name: /Render|Re-render/ });
  if (!(await renderButton.isEnabled().catch(() => false))) {
    const checkboxes = page.getByRole('checkbox');
    const maxToggles = Math.min(await checkboxes.count(), 34);
    for (let i = 0; i < maxToggles; i++) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.click();
        await sleep(80);
      }
      if (await renderButton.isEnabled().catch(() => false)) {
        break;
      }
    }
  }

  if (!(await renderButton.isEnabled().catch(() => false))) {
    throw new Error('Render button is still disabled after auto-selection attempts.');
  }
}

async function clickRender(page) {
  const rerender = page.getByRole('button', { name: 'Re-render' });
  if (await rerender.isVisible().catch(() => false)) {
    await rerender.click();
    return;
  }
  await page.getByRole('button', { name: 'Render' }).click();
}

async function clickClear(page) {
  await page.getByRole('button', { name: 'Clear' }).click();
}

async function createBenchmarkSession() {
  const response = await fetch(`${API_URL}/api/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseline_state: { program_ids: [], versions: [], selected_event_ids: [] },
      new_data_state: { program_ids: [], versions: [], selected_event_ids: [] },
      global_filters: {},
      rendered_event_ids: [],
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create benchmark session: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (!payload?.session_id) {
    throw new Error('Session create response missing session_id');
  }
  return payload.session_id;
}

async function run() {
  const sessionId = await createBenchmarkSession();
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-precise-memory-info'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SESSION_STORAGE_KEY, value: sessionId }
  );
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Performance.enable');

  const targetUrl = `${BASE_URL}${DASHBOARD_PATH}`;
  console.log(`Opening ${targetUrl} with session ${sessionId}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  await page.getByText('Historical Data').first().waitFor({ timeout: 15000 });
  await ensureSelections(page);

  const samples = [];
  samples.push(await readMetrics(page, cdpSession, 'before_first_render'));

  await clickRender(page);
  await sleep(SETTLE_MS);
  samples.push(await readMetrics(page, cdpSession, 'after_first_render'));

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    await clickClear(page);
    await sleep(1200);
    await clickRender(page);
    await sleep(SETTLE_MS);
    samples.push(await readMetrics(page, cdpSession, `cycle_${cycle}`));
    console.log(`Completed cycle ${cycle}/${CYCLES}`);
  }

  const first = samples.find((s) => s.heapUsedBytes != null);
  const last = [...samples].reverse().find((s) => s.heapUsedBytes != null);
  const heapGrowthBytes =
    first?.heapUsedBytes != null && last?.heapUsedBytes != null
      ? last.heapUsedBytes - first.heapUsedBytes
      : null;

  const report = {
    scenario: {
      baseUrl: BASE_URL,
      path: DASHBOARD_PATH,
      cycles: CYCLES,
      settleMs: SETTLE_MS,
    },
    summary: {
      heapGrowthBytes,
      heapGrowthMB: heapGrowthBytes == null ? null : +(heapGrowthBytes / (1024 * 1024)).toFixed(2),
      samples: samples.length,
    },
    samples,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(OUTPUT_DIR, `memory-benchmark-${stamp}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Report written: ${outputPath}`);
  console.log(
    `Heap growth: ${
      report.summary.heapGrowthMB == null ? 'n/a' : `${report.summary.heapGrowthMB} MB`
    }`
  );

  await browser.close();
}

run().catch((error) => {
  console.error('[memory-benchmark] Failed:', error);
  process.exitCode = 1;
});
