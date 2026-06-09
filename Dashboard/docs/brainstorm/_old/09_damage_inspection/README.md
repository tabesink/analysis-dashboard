# Damage Inspection Documentation Package

This package is meant to be walked through with a coding agent before implementation.

## Goal

Convert the notebook `Dashboard/notebooks/py_fatigue_cycle_counting.ipynb` into a clean, testable server-side fatigue damage module, then expose it through a lightweight `Inspect Damage` workflow in the Dashboard app.

The target user-facing behavior is:

- User opens a new client route: `/inspect-damage`.
- The page lives inside the existing main layout.
- The table visually mirrors the current database/event table.
- The first columns are event metadata:
  - `Job Id`
  - `Work Order`
  - `Program ID`
- Then the table shows 21 thin channel columns.
- Each event/channel cell shows the calculated fatigue damage value for that event and channel.

## Package contents

| File | Purpose |
|---|---|
| `01_architecture_decision_record.md` | Main design decision: pure module + thin API + thin UI. |
| `02_implementation_plan.md` | Step-by-step backend/client/test implementation plan. |
| `03_server_module_design.md` | Proposed Python calculation module shape, classes, and boundaries. |
| `04_api_and_ui_contract.md` | Proposed request/response models and `/inspect-damage` page contract. |
| `05_testing_and_validation_plan.md` | Unit, integration, regression, and engineering-validation tests. |
| `06_coding_agent_prompt.md` | Ready-to-paste prompt for the coding agent. |
| `reference/fatigue_damage_skeleton.py` | Initial implementation skeleton for the pure calculation module. |

## Core design principle

Do not move notebook code directly into a route or React component.

Instead:

```text
notebook idea
  -> pure Python service module
  -> thin FastAPI route
  -> thin client table
```

The calculation module must not import FastAPI, database code, React concepts, or table/UI concepts.

## Key warning

Rainflow/cycle counting must use the full raw channel time series from the database. It must not use LTTB-downsampled plot data or any data already reduced for rendering.

