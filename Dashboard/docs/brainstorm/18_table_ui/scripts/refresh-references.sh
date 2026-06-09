#!/usr/bin/env bash
# Refresh local reference copies from canartdb-ui and database-table skill.
# Run from repo root: bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
REF_SRC="$ROOT/.references/canartdb-ui"
REF_DEST="$ROOT/docs/brainstorm/18_table_ui/reference/canartdb-ui"
SKILL_DEST="$ROOT/docs/brainstorm/18_table_ui/reference/database-table-skill"

if [[ ! -d "$REF_SRC" ]]; then
  echo "Missing reference tree: $REF_SRC" >&2
  exit 1
fi

mkdir -p \
  "$REF_DEST/src/components/upload" \
  "$REF_DEST/src/hooks" \
  "$REF_DEST/src/types" \
  "$REF_DEST/src/lib/api" \
  "$REF_DEST/src/lib" \
  "$REF_DEST/src/app/database/table/[tableId]" \
  "$REF_DEST/src/app/database/certificate/[certificateId]" \
  "$SKILL_DEST/templates"

# --- canartdb-ui: Excel / CRUD table components ---
cp "$REF_SRC/src/components/upload/TableResultsEditor.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/FailedPageEditor.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/CertificateFlatTable.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/CertificatePagesTable.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/ColumnResizeHandle.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/IndeterminateCheckbox.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/SaveConfirmDialog.tsx" "$REF_DEST/src/components/upload/"
cp "$REF_SRC/src/components/upload/index.ts" "$REF_DEST/src/components/upload/"

# --- canartdb-ui: hooks, types, API ---
cp "$REF_SRC/src/hooks/use-table-results.ts" "$REF_DEST/src/hooks/"
cp "$REF_SRC/src/hooks/use-certificate-hierarchy.ts" "$REF_DEST/src/hooks/"
cp "$REF_SRC/src/hooks/use-certificate-batch-save.ts" "$REF_DEST/src/hooks/"
cp "$REF_SRC/src/types/database.ts" "$REF_DEST/src/types/"
cp "$REF_SRC/src/lib/api/database.ts" "$REF_DEST/src/lib/api/"
cp "$REF_SRC/src/lib/review-status.ts" "$REF_DEST/src/lib/"

# --- canartdb-ui: page orchestration (routes wire tables to data) ---
cp "$REF_SRC/src/app/database/page.tsx" "$REF_DEST/src/app/database/"
cp "$REF_SRC/src/app/database/certificate/[certificateId]/page.tsx" "$REF_DEST/src/app/database/certificate/[certificateId]/"
cp "$REF_SRC/src/app/database/table/[tableId]/page.tsx" "$REF_DEST/src/app/database/table/[tableId]/"

# --- canartdb-ui: dependency manifest snippet ---
cp "$REF_SRC/package.json" "$REF_DEST/"

# --- database-table skill (flex hierarchy visual parity) ---
SKILL_SRC="$ROOT/.cursor/skills/database-table"
cp "$SKILL_SRC/tokens.md" "$SKILL_DEST/"
cp "$SKILL_SRC/DESIGN.md" "$SKILL_DEST/"
cp "$SKILL_SRC/AUDIT.md" "$SKILL_DEST/"
cp "$SKILL_SRC/templates/ColumnResizeHandle.tsx" "$SKILL_DEST/templates/"
cp "$SKILL_SRC/templates/IndeterminateCheckbox.tsx" "$SKILL_DEST/templates/"
cp "$SKILL_SRC/templates/HierarchicalTable.two-level.tsx" "$SKILL_DEST/templates/"
cp "$SKILL_SRC/templates/HierarchicalTable.three-level.tsx" "$SKILL_DEST/templates/"
cp "$SKILL_SRC/templates/types.ts" "$SKILL_DEST/templates/"

echo "References refreshed:"
echo "  $REF_DEST"
echo "  $SKILL_DEST"
