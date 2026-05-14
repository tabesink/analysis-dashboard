---
name: zoom-out
description: Give a higher-level map of an unfamiliar area of code and explain how it fits into the whole system. Use when the user asks to zoom out, requests broader context, or wants module/caller relationships explained before changing code.
---

# Zoom Out

Go up a layer of abstraction. Give a concise map of the relevant modules, callers, data flow, and ownership boundaries using the repo's domain vocabulary.

Before answering, read `docs/agents/domain.md` if present, then relevant project docs and decisions. Prefer code search, file reads, semantic search, and parallel exploration when the area is broad.

Answer with:

- The system role of this area.
- The main modules and their responsibilities.
- The important callers and callees.
- The data or control flow.
- The constraints, decisions, or risks a future change must respect.
