"""Plot image generation service using matplotlib."""

import logging
import math
from dataclasses import dataclass, field
from io import BytesIO
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib import ticker
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    logger.warning("Matplotlib not available. Install with: pip install matplotlib")

# Default color palette for category grouping (colorblind-friendly)
BASELINE_COLORS = [
    '#3b82f6',  # Blue
    '#f97316',  # Orange
    '#22c55e',  # Green
    '#a855f7',  # Purple
    '#ef4444',  # Red
    '#06b6d4',  # Cyan
    '#eab308',  # Yellow
    '#ec4899',  # Pink
]

# Default color for all curves
DEFAULT_CURVE_COLOR = '#3b82f6'


@dataclass
class CurveColorConfig:
    """User-selected curve colors.
    
    SOLID: Single Responsibility - only holds color configuration.
    """
    curve_color: str = DEFAULT_CURVE_COLOR
    filter_colors: dict = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Optional[dict]) -> Optional["CurveColorConfig"]:
        """Create from dictionary (e.g., from API request)."""
        if not data:
            return None
        return cls(
            curve_color=data.get("curve_color") or data.get("baseline_color") or DEFAULT_CURVE_COLOR,
            filter_colors=data.get("filter_colors") or {},
        )

# Legacy colors (used when no grouping is applied)
COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
]


@dataclass
class ColorGroupingConfig:
    """Configuration for color-coded curve grouping.
    
    SOLID: Single Responsibility - only holds grouping configuration.
    """
    mode: str = "none"
    filter_category: Optional[str] = None
    custom_colors: dict = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Optional[dict]) -> Optional["ColorGroupingConfig"]:
        """Create from dictionary (e.g., from API request)."""
        if not data:
            return None
        return cls(
            mode=data.get("mode", "none"),
            filter_category=data.get("filter_category"),
            custom_colors=data.get("custom_colors") or {},
        )


@dataclass
class ColorAssigner:
    """Assigns colors to events based on configuration.
    
    SOLID: 
    - Single Responsibility: Only handles color assignment logic
    - Open/Closed: New grouping modes can be added via subclasses
    """
    curve_colors: Optional[CurveColorConfig] = None
    grouping_config: Optional[ColorGroupingConfig] = None
    event_metadata: dict = field(default_factory=dict)
    _group_colors: dict = field(default_factory=dict, init=False)
    
    def get_color(self, event_id: str) -> str:
        """Get color for an event based on config."""
        base_color = DEFAULT_CURVE_COLOR
        if self.curve_colors:
            base_color = self.curve_colors.curve_color
        
        if self.grouping_config and self.grouping_config.mode == "filter_category":
            return self._get_category_color(event_id, base_color)
        
        return base_color
    
    def _get_category_color(self, event_id: str, fallback: str) -> str:
        """Get color based on filter category value."""
        if not self.grouping_config or not self.grouping_config.filter_category:
            return fallback
        
        metadata = self.event_metadata.get(event_id, {})
        category_value = metadata.get(self.grouping_config.filter_category, "Unknown")
        
        if category_value is None:
            category_value = "Unknown"
        
        # Check custom colors first
        if self.grouping_config.custom_colors and category_value in self.grouping_config.custom_colors:
            return self.grouping_config.custom_colors[category_value]
        
        # Assign a consistent color for this group
        if category_value not in self._group_colors:
            self._group_colors[category_value] = BASELINE_COLORS[
                len(self._group_colors) % len(BASELINE_COLORS)
            ]
        
        return self._group_colors[category_value]
    
    def get_legend_groups(self) -> list[dict]:
        """Get list of color groups for legend display."""
        if not self.grouping_config or self.grouping_config.mode == "none":
            return []
        
        groups = []
        for group_key, color in self._group_colors.items():
            groups.append({
                "group_key": group_key,
                "display_name": str(group_key),
                "color": color,
            })
        return groups


@dataclass
class AxisLimits:
    x_min: float
    x_max: float
    y_min: float
    y_max: float


@dataclass
class PlotAxisSettings:
    """Per-plot axis and grid configuration.
    
    SOLID: Single Responsibility - only holds axis/grid settings.
    """
    x_min: Optional[float] = None
    x_max: Optional[float] = None
    y_min: Optional[float] = None
    y_max: Optional[float] = None
    grid_count: int = 7
    
    @classmethod
    def from_dict(cls, data: Optional[dict]) -> Optional["PlotAxisSettings"]:
        """Create from dictionary (e.g., from API request)."""
        if not data:
            return None
        return cls(
            x_min=data.get("x_min"),
            x_max=data.get("x_max"),
            y_min=data.get("y_min"),
            y_max=data.get("y_max"),
            grid_count=data.get("grid_count", 7),
        )


def _get_valid_xy(event_data: pd.DataFrame) -> tuple[list, list]:
    """Extract valid x, y values (scaled by 1000) from event data."""
    valid = event_data[event_data[['x', 'y']].notna().all(axis=1)]
    if len(valid) == 0:
        return [], []
    return (valid['x'].values / 1000).tolist(), (valid['y'].values / 1000).tolist()


def _format_label(channel: str) -> str:
    """Format channel name as axis label."""
    if '(' in channel or '[' in channel:
        return channel
    return channel.replace('_', ' ').title()


def _compute_symmetric_limit(val_min: float, val_max: float, buffer: float) -> tuple[float, float]:
    """Compute axis limits, symmetric if data crosses zero."""
    limit_min = val_min - buffer
    limit_max = val_max + buffer
    if val_min < 0 < val_max:
        abs_max = max(abs(limit_min), abs(limit_max))
        limit = math.ceil(abs_max / 5) * 5
        return -limit, limit
    return limit_min, limit_max


def _create_tick_locations(axis_min: float, axis_max: float, count: int = 7) -> list[float]:
    """Create evenly spaced tick locations."""
    return [axis_min + i * (axis_max - axis_min) / (count - 1) for i in range(count)]


def _configure_axis(ax, xlim: tuple, ylim: tuple, fontsize: int, grid_count: int = 7):
    """Configure axis ticks, grid, and styling.
    
    Args:
        ax: Matplotlib axes
        xlim: X-axis limits tuple (min, max)
        ylim: Y-axis limits tuple (min, max)
        fontsize: Font size for tick labels
        grid_count: Number of grid lines (determines spacing)
    """
    x_locs = _create_tick_locations(xlim[0], xlim[1], count=grid_count)
    y_locs = _create_tick_locations(ylim[0], ylim[1], count=grid_count)
    
    # Center axis lines at middle tick
    middle_index = grid_count // 2
    ax.axvline(x=x_locs[middle_index], color='black', linewidth=0.3, zorder=10)
    ax.axhline(y=y_locs[middle_index], color='black', linewidth=0.3, zorder=10)
    
    ax.xaxis.set_major_locator(ticker.FixedLocator(x_locs))
    ax.yaxis.set_major_locator(ticker.FixedLocator(y_locs))
    ax.xaxis.set_major_formatter(ticker.FormatStrFormatter('%.1f'))
    ax.yaxis.set_major_formatter(ticker.FormatStrFormatter('%.1f'))
    
    ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.3)
    ax.tick_params(axis='both', which='major', width=0, length=0, pad=2, labelsize=fontsize)
    ax.set_facecolor('white')
    
    for spine in ax.spines.values():
        spine.set_color('none')


class PlotImageService:
    """Plot image generation service using matplotlib.
    
    SOLID Principles:
    - Single Responsibility: Generates plot images from data
    - Open/Closed: Color assignment delegated to ColorAssigner
    - Dependency Inversion: Accepts color config rather than hardcoding behavior
    """
    
    def __init__(self):
        self.enabled = MATPLOTLIB_AVAILABLE
        self.colors = COLORS if MATPLOTLIB_AVAILABLE else []
    
    def is_available(self) -> bool:
        return self.enabled

    def _plot_curves(
        self,
        ax,
        data: pd.DataFrame,
        alpha: float,
        linewidth: float,
        all_x: list,
        all_y: list,
        curves_meta: Optional[list] = None,
        color_assigner: Optional[ColorAssigner] = None,
    ) -> int:
        """Plot all events. Returns count of events plotted."""
        if len(data) == 0:
            return 0
        
        count = 0
        for idx, event_id in enumerate(data['event_id'].unique()):
            event_data = data[data['event_id'] == event_id]
            x_vals, y_vals = _get_valid_xy(event_data)
            
            if not x_vals:
                continue
            
            all_x.extend(x_vals)
            all_y.extend(y_vals)
            
            if color_assigner:
                color = color_assigner.get_color(event_id)
            else:
                color = self.colors[idx % len(self.colors)]
            
            ax.plot(x_vals, y_vals, color=color, alpha=alpha, linewidth=linewidth)
            
            if curves_meta is not None:
                curves_meta.append({"event_id": event_id, "color": color})
            count += 1
        
        return count
    
    def _set_axis_limits(
        self, 
        ax, 
        all_x: list, 
        all_y: list,
        custom_settings: Optional[PlotAxisSettings] = None,
    ) -> AxisLimits:
        """Calculate and set axis limits from data or custom settings.
        
        Args:
            ax: Matplotlib axes
            all_x: List of all x values
            all_y: List of all y values
            custom_settings: Optional custom axis settings (overrides auto-calculation)
        """
        if not all_x or not all_y:
            xlim, ylim = ax.get_xlim(), ax.get_ylim()
            return AxisLimits(xlim[0], xlim[1], ylim[0], ylim[1])
        
        # Calculate auto limits from data
        data_x_min, data_x_max = min(all_x), max(all_x)
        data_y_min, data_y_max = min(all_y), max(all_y)
        
        x_range = data_x_max - data_x_min
        y_range = data_y_max - data_y_min
        x_buffer = x_range * 0.02 if x_range > 0 else 0.1
        y_buffer = y_range * 0.02 if y_range > 0 else 0.1
        
        auto_x_lim = _compute_symmetric_limit(data_x_min, data_x_max, x_buffer)
        auto_y_lim = _compute_symmetric_limit(data_y_min, data_y_max, y_buffer)
        
        # Apply custom settings if provided (override auto limits)
        if custom_settings:
            x_lim = (
                custom_settings.x_min if custom_settings.x_min is not None else auto_x_lim[0],
                custom_settings.x_max if custom_settings.x_max is not None else auto_x_lim[1],
            )
            y_lim = (
                custom_settings.y_min if custom_settings.y_min is not None else auto_y_lim[0],
                custom_settings.y_max if custom_settings.y_max is not None else auto_y_lim[1],
            )
        else:
            x_lim = auto_x_lim
            y_lim = auto_y_lim
        
        ax.set_xlim(x_lim)
        ax.set_ylim(y_lim)
        
        # Extend slightly to ensure grid lines visible
        xlim, ylim = ax.get_xlim(), ax.get_ylim()
        x_ext = (xlim[1] - xlim[0]) * 0.01
        y_ext = (ylim[1] - ylim[0]) * 0.01
        ax.set_xlim(xlim[0] - x_ext, xlim[1] + x_ext)
        ax.set_ylim(ylim[0] - y_ext, ylim[1] + y_ext)
        
        final_xlim, final_ylim = ax.get_xlim(), ax.get_ylim()
        return AxisLimits(final_xlim[0], final_xlim[1], final_ylim[0], final_ylim[1])

    def generate_grid_cell_image(
        self,
        plot_data: pd.DataFrame,
        x_channel: str,
        y_channel: str,
        title: str,
        width: int = 400,
        height: int = 300,
        format: str = "png",
        show_legend: bool = False,
        color_grouping: Optional[dict] = None,
        event_metadata: Optional[dict] = None,
        axis_settings: Optional[dict] = None,
        curve_colors: Optional[dict] = None,
    ) -> Optional[bytes]:
        """Generate a grid cell image with multiple events overlaid.
        
        Args:
            plot_data: DataFrame with columns [event_id, x, y]
            x_channel: X-axis channel name for label
            y_channel: Y-axis channel name for label
            title: Plot title
            width: Image width in pixels
            height: Image height in pixels
            format: Output format (png, jpg, etc.)
            show_legend: Whether to show legend (not implemented yet)
            color_grouping: Optional dict with color grouping config
            event_metadata: Optional dict of event_id -> metadata dict
            axis_settings: Optional dict with axis/grid settings
            curve_colors: Optional dict with user-selected colors
        
        Returns:
            Image bytes or None if generation fails
        """
        if not self.enabled or plot_data.empty:
            return None
        
        try:
            dpi = 200
            fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
            
            fontsize = 3.5
            plt.rcParams.update({
                'font.family': 'sans-serif',
                'font.sans-serif': ['Arial', 'Helvetica', 'DejaVu Sans', 'Liberation Sans', 'sans-serif'],
                'font.size': fontsize,
                'lines.linewidth': 0.3,
            })
            
            curve_color_config = CurveColorConfig.from_dict(curve_colors)
            grouping_config = ColorGroupingConfig.from_dict(color_grouping)
            
            color_assigner = ColorAssigner(
                curve_colors=curve_color_config,
                grouping_config=grouping_config,
                event_metadata=event_metadata or {},
            )
            
            plot_axis_settings = PlotAxisSettings.from_dict(axis_settings)
            grid_count = plot_axis_settings.grid_count if plot_axis_settings else 7
            
            all_x, all_y = [], []
            
            self._plot_curves(
                ax, plot_data, alpha=0.5, linewidth=0.3,
                all_x=all_x, all_y=all_y,
                color_assigner=color_assigner,
            )
            
            self._set_axis_limits(ax, all_x, all_y, custom_settings=plot_axis_settings)
            _configure_axis(ax, ax.get_xlim(), ax.get_ylim(), fontsize, grid_count=grid_count)
            
            ax.set_xlabel(_format_label(x_channel), fontsize=fontsize)
            ax.set_ylabel(_format_label(y_channel), fontsize=fontsize)
            fig.patch.set_facecolor('white')
            
            plt.subplots_adjust(bottom=0.20, top=0.95, left=0.15, right=0.95)
            
            buffer = BytesIO()
            plt.savefig(buffer, format=format, dpi=dpi, facecolor='white', edgecolor='none', )
            buffer.seek(0)
            img_bytes = buffer.read()
            buffer.close()
            plt.close(fig)
            
            return img_bytes
            
        except Exception as e:
            logger.error(f"Failed to generate grid cell image: {e}", exc_info=True)
            plt.close('all')
            return None

    def generate_interactive_image(
        self,
        plot_data: pd.DataFrame,
        visible_event_ids: list[str],
        x_channel: str,
        y_channel: str,
        title: str,
        width: int = 1200,
        height: int = 800,
        opacity: float = 0.5,
        axis_settings: Optional[dict] = None,
        curve_colors: Optional[dict] = None,
    ) -> Optional[dict]:
        """Generate interactive plot image with metadata for click handling."""
        if not self.enabled or plot_data.empty:
            return None
        
        filtered = plot_data[plot_data['event_id'].isin(set(visible_event_ids))]
        if filtered.empty:
            return None
        
        try:
            from PIL import Image
            
            dpi = 200
            fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi, constrained_layout=True)
            
            fontsize = 8
            plt.rcParams.update({
                'font.family': 'sans-serif',
                'font.sans-serif': ['Arial', 'Helvetica', 'DejaVu Sans', 'Liberation Sans', 'sans-serif'],
                'font.size': fontsize,
                'lines.linewidth': 1.0,
            })
            
            plot_axis_settings = PlotAxisSettings.from_dict(axis_settings)
            grid_count = plot_axis_settings.grid_count if plot_axis_settings else 21
            curve_color_config = CurveColorConfig.from_dict(curve_colors)
            color_assigner = ColorAssigner(curve_colors=curve_color_config)
            
            all_x, all_y, curves_meta = [], [], []
            
            self._plot_curves(
                ax, filtered, alpha=opacity, linewidth=1.0,
                all_x=all_x, all_y=all_y, curves_meta=curves_meta,
                color_assigner=color_assigner,
            )
            
            limits = self._set_axis_limits(ax, all_x, all_y, custom_settings=plot_axis_settings)
            _configure_axis(ax, ax.get_xlim(), ax.get_ylim(), fontsize, grid_count=grid_count)
            
            ax.set_xlabel(_format_label(x_channel), fontsize=fontsize)
            ax.set_ylabel(_format_label(y_channel), fontsize=fontsize)
            fig.patch.set_facecolor('white')
            
            pos = ax.get_position()
            
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=dpi, facecolor='white')
            buffer.seek(0)
            img_bytes = buffer.read()
            buffer.close()
            plt.close(fig)
            
            img = Image.open(BytesIO(img_bytes))
            actual_width, actual_height = img.size
            
            return {
                "image_bytes": img_bytes,
                "image_width": actual_width,
                "image_height": actual_height,
                "curves": curves_meta,
                "axis_limits": {"x_min": limits.x_min, "x_max": limits.x_max, "y_min": limits.y_min, "y_max": limits.y_max},
                "plot_area": {"left": pos.x0, "right": pos.x1, "top": 1 - pos.y1, "bottom": 1 - pos.y0},
            }
            
        except Exception as e:
            logger.error(f"Failed to generate interactive image: {e}", exc_info=True)
            plt.close('all')
            return None

    def find_nearest_curve_value(
        self,
        plot_data: pd.DataFrame,
        visible_event_ids: list[str],
        click_x_norm: float,
        click_y_norm: float,
        axis_limits: dict,
        plot_area: dict,
        threshold: float = 0.05,
    ) -> Optional[dict]:
        """Find the nearest curve value at a click position."""
        import numpy as np
        
        filtered = plot_data[plot_data['event_id'].isin(set(visible_event_ids))]
        if filtered.empty:
            return None
        
        left, right = plot_area["left"], plot_area["right"]
        top, bottom = plot_area["top"], plot_area["bottom"]
        
        if not (left <= click_x_norm <= right and top <= click_y_norm <= bottom):
            return None
        
        x_frac = (click_x_norm - left) / (right - left)
        y_frac = 1 - (click_y_norm - top) / (bottom - top)
        
        x_min, x_max = axis_limits["x_min"], axis_limits["x_max"]
        y_min, y_max = axis_limits["y_min"], axis_limits["y_max"]
        
        click_x = x_min + x_frac * (x_max - x_min)
        click_y = y_min + y_frac * (y_max - y_min)
        
        best_result, best_dist = None, float('inf')
        y_range = y_max - y_min if y_max != y_min else 1
        
        for idx, event_id in enumerate(filtered['event_id'].unique()):
            event_data = filtered[filtered['event_id'] == event_id]
            x_vals, y_vals = _get_valid_xy(event_data)
            if len(x_vals) < 2:
                continue
            
            x_arr, y_arr = np.array(x_vals), np.array(y_vals)
            sorted_idx = np.argsort(x_arr)
            x_sorted, y_sorted = x_arr[sorted_idx], y_arr[sorted_idx]
            
            if click_x < x_sorted[0] or click_x > x_sorted[-1]:
                continue
            
            interp_y = float(np.interp(click_x, x_sorted, y_sorted))
            dist = abs((interp_y - click_y) / y_range)
            
            if dist < best_dist and dist < threshold:
                best_dist = dist
                best_result = {
                    "event_id": event_id,
                    "color": self.colors[idx % len(self.colors)],
                    "data_x": click_x,
                    "data_y": interp_y,
                    "distance": dist,
                }
        
        return best_result
