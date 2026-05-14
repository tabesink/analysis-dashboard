"""Convert binary RSP uploads into the tagged CSV format used by ingestion."""

from __future__ import annotations

import csv
import importlib
import io
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class RSPConversionResult:
    """Tagged CSV bytes generated from one RSP file."""

    filename: str
    content: bytes
    row_count: int
    channel_count: int


class RSPConverter:
    """Convert RSP files with rpc-reader and emit ingestion-compatible CSV."""

    def convert(self, filename: str, content: bytes) -> RSPConversionResult:
        """Convert an uploaded RSP file to tagged CSV bytes."""
        with tempfile.NamedTemporaryFile(suffix=".rsp") as tmp:
            tmp.write(content)
            tmp.flush()
            try:
                df, channels, headers = self._load_via_rpc_reader(Path(tmp.name))
            except SystemExit as exc:
                message = exc.args[0] if exc.args else str(exc)
                raise RuntimeError(f"rpc-reader failed: {message}") from exc

        channel_names = self._extract_channel_names(channels, df.shape[1])
        df.columns = channel_names
        units = self._extract_channel_units(channels, len(channel_names))
        dt = self._resolve_dt(headers)

        csv_name = f"{Path(filename).stem}.csv"
        csv_content = self._to_tagged_csv_bytes(df, channel_names, units, dt)
        return RSPConversionResult(
            filename=csv_name,
            content=csv_content,
            row_count=len(df),
            channel_count=len(channel_names),
        )

    def _load_via_rpc_reader(self, rsp_path: Path) -> tuple[pd.DataFrame, list[Any], dict[str, Any]]:
        ctor = self._resolve_rpc_reader_ctor()
        reader = ctor(rsp_path)

        for load_method in ("import_rpc_data_from_file", "read", "load", "parse"):
            fn = getattr(reader, load_method, None)
            if callable(fn):
                fn()
                break

        data = None
        get_data = getattr(reader, "get_data", None)
        if callable(get_data):
            data = get_data()
        elif hasattr(reader, "data"):
            data = reader.data

        if data is None:
            raise RuntimeError("rpc-reader could not extract numeric channel data")

        channels = []
        get_channels = getattr(reader, "get_channels", None)
        if callable(get_channels):
            channels = get_channels() or []
        elif hasattr(reader, "channels"):
            channels = reader.channels or []

        headers = None
        get_headers = getattr(reader, "get_headers", None)
        if callable(get_headers):
            headers = get_headers()
        elif hasattr(reader, "headers"):
            headers = reader.headers

        return pd.DataFrame(data), channels, self._to_header_dict(headers)

    def _resolve_rpc_reader_ctor(self) -> Any:
        try:
            rpc_reader = importlib.import_module("rpc_reader")
        except ImportError as exc:
            raise RuntimeError("RSP conversion requires the rpc-reader package") from exc

        reader_names = ("ReadRPC", "RPCReader")
        for name in reader_names:
            ctor = getattr(rpc_reader, name, None)
            if callable(ctor):
                return ctor

        for submodule in ("rpc_reader", "reader", "core"):
            try:
                module = importlib.import_module(f"rpc_reader.{submodule}")
            except ImportError:
                continue
            for name in reader_names:
                ctor = getattr(module, name, None)
                if callable(ctor):
                    return ctor

        raise RuntimeError("Installed rpc-reader package has no supported reader class")

    def _to_tagged_csv_bytes(
        self,
        df: pd.DataFrame,
        channel_names: list[str],
        units: list[str],
        dt: float,
    ) -> bytes:
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)

        writer.writerow(["#HEADER"])
        writer.writerow(["#TITLES"])
        writer.writerow(["", ""] + [f"{i + 1} {name}" for i, name in enumerate(channel_names)])
        writer.writerow(["#UNITS"])
        writer.writerow(["", ""] + units)
        writer.writerow(["#DATATYPES"])
        writer.writerow(["Huge", "Double"] + ["Float"] * len(channel_names))
        writer.writerow(["#DATA"])

        for row_idx, values in enumerate(df.itertuples(index=False, name=None), start=1):
            time_value = f"{(row_idx - 1) * dt:.6f}"
            writer.writerow([row_idx, time_value, *values])

        return buffer.getvalue().encode("utf-8")

    def _to_header_dict(self, obj: Any) -> dict[str, Any]:
        if obj is None:
            return {}
        if isinstance(obj, dict):
            return {str(k): v for k, v in obj.items()}
        if isinstance(obj, list):
            return {f"item_{i}": item for i, item in enumerate(obj)}
        return {"raw_header": obj}

    def _extract_channel_names(self, channels: list[Any], width: int) -> list[str]:
        names = []
        for i in range(width):
            channel = channels[i] if i < len(channels) else None
            name = self._get_channel_value(
                channel,
                (
                    "Description",
                    "description",
                    "DESC",
                    "title",
                    "Title",
                    "name",
                    "Name",
                    "channel_name",
                ),
            )
            names.append(str(name).strip() if name else f"channel_{i + 1}")

        seen: dict[str, int] = {}
        unique_names = []
        for name in names:
            count = seen.get(name, 0)
            seen[name] = count + 1
            unique_names.append(name if count == 0 else f"{name}_{count + 1}")
        return unique_names

    def _extract_channel_units(self, channels: list[Any], width: int) -> list[str]:
        units = []
        for i in range(width):
            channel = channels[i] if i < len(channels) else None
            unit = self._get_channel_value(channel, ("units", "Units", "unit"))
            units.append(str(unit).strip() if unit else "")
        return units

    def _get_channel_value(self, channel: Any, names: tuple[str, ...]) -> Any:
        if channel is None:
            return None
        if isinstance(channel, str):
            return channel if "name" in names else None
        if isinstance(channel, dict):
            for name in names:
                if channel.get(name):
                    return channel[name]
            return None
        for name in names:
            value = getattr(channel, name, None)
            if value:
                return value
        return None

    def _resolve_dt(self, header_dict: dict[str, Any]) -> float:
        for key in (
            "DELTA_T",
            "DELTA T",
            "DELTAT",
            "delta_t",
            "sample_interval",
            "x_increment",
        ):
            if key not in header_dict:
                continue
            try:
                return float(header_dict[key])
            except (TypeError, ValueError):
                continue
        return 1.0
