---
name: Global column filter values
overview: Make the column filter dropdowns (Program ID, Version, etc.) show all distinct values from the entire database, not just the values on the current page.
todos:
  - id: server-facets
    content: Add DatasetListResponse model and facets query to list_datasets endpoint
    status: completed
  - id: client-type-facets
    content: Add DatasetListResponse type and update API client + hook to expose facets
    status: completed
  - id: use-facets-ui
    content: Replace getUniqueValues memo in page.tsx to use server facets for dropdown values
    status: completed
isProject: false
---

# Column Filter Dropdowns: Show All Values Globally

## Problem

`getUniqueValues` (line 493 of [page.tsx](client/src/app/database/page.tsx)) computes dropdown options from `datasets`, which is only the current page. When paginated, filters only show values from the visible rows.

## Approach

Return a `facets` map alongside the paginated items from the server so the client has the full set of distinct values without a second request.

## Server Changes

### 1. Add `facets` to the `list_datasets` response ([server/routers/upload.py](server/routers/upload.py) lines 210-249)

- Query distinct values for each filterable column from `dim_event WHERE is_deleted = false`
- Return them as an extra `facets: dict[str, list[str]]` field in the response
- Use a single DuckDB query with multiple `DISTINCT` aggregations for efficiency:

```python
facets_query = """
    SELECT
        ARRAY_AGG(DISTINCT program_id ORDER BY program_id) AS program_id,
        ARRAY_AGG(DISTINCT version ORDER BY version) AS version,
        ARRAY_AGG(DISTINCT status ORDER BY status) FILTER (status IS NOT NULL) AS status,
        ARRAY_AGG(DISTINCT suspension_component ORDER BY suspension_component) FILTER (suspension_component IS NOT NULL) AS suspension_component,
        ARRAY_AGG(DISTINCT axle_location ORDER BY axle_location) FILTER (axle_location IS NOT NULL) AS axle_location,
        ARRAY_AGG(DISTINCT gross_vehicle_weight_range_lbs ORDER BY gross_vehicle_weight_range_lbs) FILTER (...) AS gross_vehicle_weight_range_lbs,
        ARRAY_AGG(DISTINCT drive_type ORDER BY drive_type) FILTER (...) AS drive_type,
        ARRAY_AGG(DISTINCT material_construction ORDER BY material_construction) FILTER (...) AS material_construction,
        ARRAY_AGG(DISTINCT steering_position ORDER BY steering_position) FILTER (...) AS steering_position,
        ARRAY_AGG(DISTINCT vehicle_type ORDER BY vehicle_type) FILTER (...) AS vehicle_type
    FROM dim_event WHERE is_deleted = false
"""
```

- Since `PaginatedResponse` is a generic shared model, we should **not** modify it. Instead, create a small response model specific to this endpoint:

```python
class DatasetListResponse(BaseModel):
    items: list[DatasetInfo]
    total: int
    limit: int
    offset: int
    has_more: bool
    facets: dict[str, list[str]]
```

### 2. Update the endpoint signature

Change `response_model` from `PaginatedResponse[DatasetInfo]` to `DatasetListResponse`.

## Client Changes

### 3. Update the `PaginatedResponse` type or add a new type ([client/src/types/upload.ts](client/src/types/upload.ts))

Add `DatasetListResponse` extending the existing paginated shape with an optional `facets` field:

```typescript
export interface DatasetListResponse {
  items: DatasetInfo[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  facets: Record<string, string[]>;
}
```

### 4. Update `uploadApi.listDatasets` return type ([client/src/lib/api/upload.ts](client/src/lib/api/upload.ts))

Change return type to `DatasetListResponse`.

### 5. Expose `facets` from `useUploadedDatasets` hook ([client/src/hooks/use-uploaded-datasets.ts](client/src/hooks/use-uploaded-datasets.ts))

- Add `facets` state: `Record<string, string[]>`
- Populate from `response.facets` when fetch completes
- Expose it in the return value

### 6. Use `facets` for dropdown values in [page.tsx](client/src/app/database/page.tsx)

Replace the `getUniqueValues` memo (line 493-507) to prefer server `facets` when available, with a mapping from display column keys (`displayProgramId`) to server column names (`program_id`):

```typescript
const getUniqueValues = useMemo(() => {
  if (Object.keys(facets).length === 0) return {};
  const keyToServerColumn: Record<string, string> = {
    displayProgramId: 'program_id',
    displayVersion: 'version',
    displayStatus: 'status',
    displaySuspension: 'suspension_component',
    displayAxle: 'axle_location',
    displayGrossVehicleWeight: 'gross_vehicle_weight_range_lbs',
    displayDriveType: 'drive_type',
    displayMaterial: 'material_construction',
    displaySteeringPosition: 'steering_position',
    displayVehicleType: 'vehicle_type',
  };
  const uniqueValues: Record<string, string[]> = {};
  columnDefinitions
    .filter((column) => column.key !== 'displayEvent')
    .forEach((column) => {
      const serverCol = keyToServerColumn[column.key];
      if (serverCol && facets[serverCol]) {
        uniqueValues[column.key] = facets[serverCol];
      } else {
        // Fallback for dynamic metadata columns
        const values = new Set<string>();
        datasets.forEach((ds) => {
          const value = getColumnValue(ds, column.key);
          if (value && value !== '') values.add(value);
        });
        uniqueValues[column.key] = Array.from(values).sort();
      }
    });
  return uniqueValues;
}, [columnDefinitions, datasets, facets]);
```

