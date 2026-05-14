---
name: rsp channel names
overview: Replace the current generic `channel_N` fallback for RSP conversion with channel descriptions read from the RSP header via `rpc-reader` metadata, and verify both the notebook path and production upload converter preserve those names.
todos:
  - id: notebook-description
    content: Update notebook channel extraction to prefer RSP `Description` metadata
    status: completed
  - id: server-description
    content: Update production RSP converter to prefer `Description` metadata
    status: completed
  - id: converter-test
    content: Adjust converter test to cover `Description` channel metadata
    status: completed
  - id: verify
    content: Run targeted converter test and inspect generated titles if fixture is available
    status: completed
isProject: false
---

# RSP Channel Name Fix

## Target Behavior

Use the RSP header's per-channel description as the channel title source. In `rpc-reader`, those values are exposed as `channels[i]["Description"]`, derived from `DESC.CHAN_N`; the current extractor ignores that field and only checks `name`, `Name`, and `channel_name`.

Relevant current code:

```112:129:notebooks/rsp_to_csv_v3.ipynb

def _extract_channel_names(channels, width):
    names = []
    for i in range(width):
        ch = channels[i] if i < len(channels) else None

        name = None
        if isinstance(ch, str):
            name = ch
        elif isinstance(ch, dict):
            name = ch.get("name") or ch.get("Name") or ch.get("channel_name")
```

Production has the same gap in `[server/services/etl/rsp_converter.py](server/services/etl/rsp_converter.py)`.

## Implementation Plan

- Update `[notebooks/rsp_to_csv_v3.ipynb](notebooks/rsp_to_csv_v3.ipynb)` so `_extract_channel_names` checks `Description` / `description` / `DESC` / `title` before generic fallbacks, and still preserves uniqueness.
- Remove or demote the neighboring CSV title workaround in the notebook so real RSP metadata wins; keep a final `channel_N` fallback only when the RSP truly lacks descriptions.
- Update `[server/services/etl/rsp_converter.py](server/services/etl/rsp_converter.py)` to use the same source ordering via `_get_channel_value(channel, (...))`, with `Description` first for `rpc-reader` dict channels.
- Add/adjust `[tests/server/services/test_rsp_converter.py](tests/server/services/test_rsp_converter.py)` so the mocked `rpc_reader` channel metadata uses `Description` and proves output titles become `1 <description>`, `2 <description>`.
- If the notebook/server behavior changes are accepted, add a short note to the existing RSP task documentation rather than creating a new architecture decision; this is a bug fix to the existing P2-12 RSP conversion behavior.

## Verification

- Run the targeted backend test for the converter: `pytest tests/server/services/test_rsp_converter.py`.
- If an actual `.rsp` file is available locally, rerun the notebook conversion and inspect the generated `#TITLES` row for real `DESC.CHAN_N` names instead of `channel_N`.

