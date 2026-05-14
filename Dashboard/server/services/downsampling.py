"""LTTB (Largest Triangle Three Buckets) downsampling algorithm."""

import numpy as np
import pandas as pd


class LTTBDownsampler:
    """
    Inflection-aware 2D downsampler using segmented canonical LTTB.

    Output contract (must remain stable for downstream consumers):
    - returns DataFrame with exactly `x`, `y` columns
    - finite numeric values only (no NaN/Inf)
    - stable ascending source-index order
    - output size is bounded by `target_points`
    """

    def __init__(
        self,
        target_points: int = 5000,
        inflection_eps: float = 1e-6,
        point_budget: int = 100,
    ):
        self.target_points = int(target_points)
        self.inflection_eps = float(inflection_eps)
        self.point_budget = int(point_budget)

    def downsample(
        self,
        df: pd.DataFrame,
        x_col: str = "x",
        y_col: str = "y",
    ) -> pd.DataFrame:
        """Downsample DataFrame using inflection anchors + segmented LTTB."""
        if df.empty:
            return pd.DataFrame(columns=["x", "y"])

        x = np.asarray(df[x_col], dtype=np.float64)
        y = np.asarray(df[y_col], dtype=np.float64)

        valid_mask = ~(np.isnan(x) | np.isnan(y))
        x = x[valid_mask]
        y = y[valid_mask]

        n = len(x)
        target = max(1, int(self.target_points))
        if n == 0:
            return pd.DataFrame(columns=["x", "y"])
        if n <= target:
            return self._build_output(x, y, np.arange(n, dtype=np.int64), target)

        indices = self._downsample_indices(x, y, target)
        return self._build_output(x, y, indices, target)

    def _build_output(
        self,
        x: np.ndarray,
        y: np.ndarray,
        indices: np.ndarray,
        target: int,
    ) -> pd.DataFrame:
        """Apply output-contract checks and return stable x/y frame."""
        idx = np.asarray(indices, dtype=np.int64)
        idx = idx[(idx >= 0) & (idx < len(x))]
        idx = np.unique(idx)
        if len(idx) > target:
            idx = self._subsample_with_endpoints(idx, target)
        if len(idx) == 0 and len(x) > 0:
            idx = np.array([0], dtype=np.int64)

        out_x = x[idx]
        out_y = y[idx]
        finite_mask = np.isfinite(out_x) & np.isfinite(out_y)
        out_x = out_x[finite_mask]
        out_y = out_y[finite_mask]

        return pd.DataFrame({"x": out_x, "y": out_y})

    def _downsample_indices(self, x: np.ndarray, y: np.ndarray, target: int) -> np.ndarray:
        n = len(x)
        if n <= target:
            return np.arange(n, dtype=np.int64)
        if target <= 2:
            return np.linspace(0, n - 1, target, dtype=np.int64)

        # Normalize for numeric stability in geometry calculations.
        x_n = (x - x.min()) / (x.max() - x.min() + 1e-12)
        y_n = (y - y.min()) / (y.max() - y.min() + 1e-12)

        anchors = self._inflection_points(x_n, y_n)
        anchors = np.array(sorted({0, n - 1, *anchors}), dtype=np.int64)

        segments = [
            (int(anchors[i]), int(anchors[i + 1]))
            for i in range(len(anchors) - 1)
            if anchors[i + 1] - anchors[i] > 1
        ]
        if not segments:
            return np.linspace(0, n - 1, target, dtype=np.int64)

        curvatures = np.array(
            [self._segment_curvature(x_n, y_n, s, e) for s, e in segments],
            dtype=np.float64,
        )
        weights = curvatures + 1e-12

        available = target - len(anchors)
        if available <= 0:
            return self._subsample_with_endpoints(anchors, target)

        budgets = self._allocate_segment_budgets(weights, available, self.point_budget)

        selected: set[int] = set(anchors.tolist())
        for (start, end), budget in zip(segments, budgets, strict=False):
            if budget <= 0:
                continue
            selected.update(self._lttb_segment(x_n, y_n, start, end, int(budget)))

        return self._enforce_exact_budget(selected, n, target)

    def _inflection_points(self, x: np.ndarray, y: np.ndarray) -> list[int]:
        """Detect inflection points via sign change of signed curvature."""
        dx = np.diff(x)
        dy = np.diff(y)

        cross = dx[:-1] * dy[1:] - dy[:-1] * dx[1:]
        mag = np.abs(cross)
        sign = np.sign(cross)

        infl = np.where(
            (sign[:-1] * sign[1:] < 0)
            & (mag[:-1] > self.inflection_eps)
            & (mag[1:] > self.inflection_eps)
        )[0] + 1
        return infl.tolist()

    def _segment_curvature(self, x: np.ndarray, y: np.ndarray, start: int, end: int) -> float:
        """Integrated absolute curvature over one segment."""
        dx = np.diff(x[start:end])
        dy = np.diff(y[start:end])
        if len(dx) < 2:
            return 0.0
        return float(np.sum(np.abs(dx[:-1] * dy[1:] - dy[:-1] * dx[1:])))

    def _allocate_segment_budgets(
        self,
        weights: np.ndarray,
        available: int,
        point_budget: int,
    ) -> np.ndarray:
        """Allocate integer point budgets across segments."""
        n_seg = len(weights)
        if n_seg == 0 or available <= 0:
            return np.zeros(n_seg, dtype=np.int64)

        budgets = np.zeros(n_seg, dtype=np.int64)
        min_budget = max(0, int(point_budget))
        if min_budget > 0 and available >= n_seg * min_budget:
            budgets += min_budget
            available -= n_seg * min_budget

        raw = available * (weights / weights.sum())
        floor_vals = np.floor(raw).astype(np.int64)
        budgets += floor_vals

        leftover = int(available - int(floor_vals.sum()))
        if leftover > 0:
            fractions = raw - floor_vals
            for idx in np.argsort(fractions)[::-1][:leftover]:
                budgets[idx] += 1

        return budgets

    def _lttb_segment(
        self,
        x: np.ndarray,
        y: np.ndarray,
        start: int,
        end: int,
        budget: int,
    ) -> list[int]:
        """
        Canonical LTTB on (start, end), excluding endpoints.
        Uses forward-only traversal and next-bucket centroid.
        """
        candidates = np.arange(start + 1, end)
        if len(candidates) <= budget:
            return candidates.tolist()

        dx = np.diff(x[start : end + 1])
        dy = np.diff(y[start : end + 1])
        dist = np.sqrt(dx * dx + dy * dy)
        dist = np.insert(dist, 0, 0.0)
        cumdist = np.cumsum(dist)
        seg_len = len(cumdist)
        local_idx = np.arange(seg_len)

        total = cumdist[-1]
        edges = np.linspace(0, total, budget + 1)

        def bucket_mask(bucket_idx: int) -> np.ndarray:
            lo = cumdist >= edges[bucket_idx]
            if bucket_idx == budget - 1:
                hi = cumdist <= edges[bucket_idx + 1]
            else:
                hi = cumdist < edges[bucket_idx + 1]
            return lo & hi

        selected: list[int] = []
        prev = start

        for i in range(budget):
            rel_prev = prev - start
            bucket = np.where(bucket_mask(i) & (local_idx > rel_prev))[0]
            if len(bucket) == 0:
                continue

            ax, ay = x[prev], y[prev]
            if i + 1 < budget:
                next_bucket = np.where(bucket_mask(i + 1))[0]
                if len(next_bucket) > 0:
                    cx = float(x[start + next_bucket].mean())
                    cy = float(y[start + next_bucket].mean())
                else:
                    cx, cy = x[end], y[end]
            else:
                cx, cy = x[end], y[end]

            bx = x[start + bucket]
            by = y[start + bucket]
            area = np.abs((ax - cx) * (by - ay) - (ax - bx) * (cy - ay))

            best = int(bucket[int(np.argmax(area))])
            idx = start + best
            selected.append(idx)
            prev = idx

        return selected

    def _subsample_with_endpoints(self, indices: np.ndarray, target: int) -> np.ndarray:
        """Subsample sorted indices while preserving first and last when possible."""
        idx = np.asarray(indices, dtype=np.int64)
        if len(idx) <= target:
            return idx
        if target <= 1:
            return np.array([idx[0]], dtype=np.int64)
        pick = np.linspace(0, len(idx) - 1, target, dtype=np.int64)
        return np.unique(idx[pick])

    def _enforce_exact_budget(self, selected: set[int], n: int, target: int) -> np.ndarray:
        """Return exactly `target` indices (for n > target) with stable ordering."""
        idx = np.array(sorted(selected), dtype=np.int64)
        if len(idx) == target:
            return idx

        if len(idx) > target:
            return self._subsample_with_endpoints(idx, target)

        # Pad with evenly spaced points from missing indices.
        need = target - len(idx)
        universe = np.arange(n, dtype=np.int64)
        missing = np.setdiff1d(universe, idx, assume_unique=False)
        if len(missing) == 0:
            return idx
        if need >= len(missing):
            return np.sort(np.concatenate([idx, missing]))
        pick = np.linspace(0, len(missing) - 1, need, dtype=np.int64)
        return np.sort(np.concatenate([idx, missing[pick]]))

    def downsample_by_factor(
        self,
        df: pd.DataFrame,
        factor: float = 0.4,
        x_col: str = "x",
        y_col: str = "y",
    ) -> pd.DataFrame:
        """Downsample by reduction factor while preserving output contract."""
        target = max(100, int(len(df) * factor))
        original_target = self.target_points
        self.target_points = target
        try:
            return self.downsample(df, x_col, y_col)
        finally:
            self.target_points = original_target

