# FALLOW-12: Refactor DatabaseOperationModal complexity

**Type:** AFK  
**Effort:** High  
**Fallow category:** Complexity hotspot  
**Fallow evidence:** CRAP 5256; cyclomatic 72; file risk score highest in codebase

## What to build

`src/components/upload/DatabaseOperationModal.tsx` (~992 LOC) is the top complexity hotspot. Fallow flags:

| Function | Cyclomatic | Cognitive | CRAP | Lines |
|----------|----------:|----------:|-----:|------:|
| `renderImportProgress` | 72 | 73 | 5256 | 191 |
| `DatabaseOperationModal` | 61 | 60 | 3782 | 841 |
| `renderExportProgress` | 56 | 53 | 3192 | 137 |
| `renderImportConfirm` | 19 | 21 | 380 | 122 |
| `importUiPhase` / `exportUiPhase` | 17 / 15 | 14 / 11 | 306 / 240 | 14 / 18 |

Refactor into focused subcomponents and hooks without changing user-visible import/export wizard behavior:

- `ImportProgressPanel`, `ExportProgressPanel`, `ImportConfirmPanel`
- `useImportUiPhase`, `useExportUiPhase` state machines
- Extract `statusLine` and `renderSummary` helpers

Target: no function above cyclomatic 20 or cognitive 15.

## Acceptance criteria

- [ ] `DatabaseOperationModal.tsx` delegates rendering to subcomponents; main component < 200 LOC
- [ ] `renderImportProgress` and `DatabaseOperationModal` no longer appear in Fallow critical complexity table
- [ ] File CRAP risk score drops below 30
- [ ] Import wizard: file select → validate → progress → confirm → complete still works
- [ ] Export wizard: select scope → progress → download still works
- [ ] Cancel and error states preserved
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
File health: DatabaseOperationModal.tsx — Risk 5256.0 (highest in codebase)
Refactoring target (efficiency 6.5): Extract renderImportProgress (cognitive: 73)
  and DatabaseOperationModal (cognitive: 60)
```
