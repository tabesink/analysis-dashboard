"""Channel map loading and validation."""

import logging
from typing import Any

import yaml

from server.exceptions import ValidationError

logger = logging.getLogger(__name__)


class ChannelMapLoader:
    """Load and validate channel_map.yaml files."""

    def load(self, content: bytes) -> dict[str, Any]:
        """
        Load channel map from YAML content.

        Args:
            content: Raw bytes of channel_map.yaml

        Returns:
            Dictionary mapping plot_key to channel configuration

        Raises:
            ValidationError: If channel map is invalid
        """
        try:
            text = content.decode("utf-8")
            raw_config = yaml.safe_load(text)

            if not raw_config:
                raise ValidationError("Channel map is empty")

            # Normalize the channel map structure
            channel_map = self._normalize_channel_map(raw_config)

            if not channel_map:
                raise ValidationError("No valid plot configurations found in channel map")

            logger.info(f"Loaded channel map with {len(channel_map)} plots")
            return channel_map

        except yaml.YAMLError as e:
            raise ValidationError(f"Invalid YAML in channel map: {e}")
        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError(f"Failed to load channel map: {e}")

    def _normalize_channel_map(self, raw_config: dict) -> dict[str, Any]:
        """
        Normalize channel map to standard format.

        Handles both flat and nested (program/version) structures:

        Flat format:
            plot_key:
              x_col: 0
              y_col: 1

        Nested format:
            program_id:
              version:
                plot_key:
                  x_col: 0
                  y_col: 1
        """
        channel_map: dict[str, Any] = {}

        for key, value in raw_config.items():
            if not isinstance(value, dict):
                continue

            # Check if this is a plot config (has x_col/y_col or x_channel/y_channel)
            if self._is_plot_config(value):
                channel_map[key] = self._normalize_plot_config(value, len(channel_map))
            else:
                # This might be nested (program/version level)
                for sub_key, sub_value in value.items():
                    if not isinstance(sub_value, dict):
                        continue

                    if self._is_plot_config(sub_value):
                        # version -> plot_key level
                        channel_map[sub_key] = self._normalize_plot_config(
                            sub_value, len(channel_map)
                        )
                    else:
                        # program -> version -> plot_key level
                        for plot_key, plot_config in sub_value.items():
                            if isinstance(plot_config, dict) and self._is_plot_config(
                                plot_config
                            ):
                                channel_map[plot_key] = self._normalize_plot_config(
                                    plot_config, len(channel_map)
                                )

        return channel_map

    def _is_plot_config(self, config: dict) -> bool:
        """Check if a dict is a plot configuration."""
        return any(
            k in config for k in ["x_col", "y_col", "x_channel", "y_channel"]
        )

    def _normalize_plot_config(self, config: dict, order: int) -> dict[str, Any]:
        """Normalize a single plot configuration."""
        return {
            "x_col": config.get("x_col", config.get("x_channel", 0)),
            "y_col": config.get("y_col", config.get("y_channel", 1)),
            "x_channel": config.get("x_channel", f"col_{config.get('x_col', 0)}"),
            "y_channel": config.get("y_channel", f"col_{config.get('y_col', 1)}"),
            "plot_order": config.get("plot_order", order),
            "x_scale_factor": config.get("x_scale_factor", 1.0),
            "y_scale_factor": config.get("y_scale_factor", 1.0),
            "x_unit": config.get("x_unit"),
            "y_unit": config.get("y_unit"),
        }

