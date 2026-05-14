'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  FilterIcon,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Columns,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUpload, useUploadedDatasets, useDatabaseOperation } from '@/hooks';
import { dashboardApi, uploadApi } from '@/lib/api';
import {
  DatabaseSidePanel,
  DatabaseOperationModal,
  DatabaseEventTree,
  ColumnResizeHandle,
  PROGRAM_SCOPE_PREFIX,
  VERSION_SCOPE_PREFIX,
} from '@/components/upload';
import { DEFAULT_FILTER_OPTIONS } from '@/config/filters';
import type { FilterOptions } from '@/types/api';
import type { DatasetInfo, UploadMetadata } from '@/types/upload';
import { selectCanWrite, useAuthStore } from '@/stores/auth-store';

type FilterState = Record<string, string>;

const REQUIRED_UPLOAD_FIELDS = ['Program ID', 'Load Version', 'Job Number', 'Work Order'];

const isChannelMapFile = (file: File): boolean =>
  file.name === 'channel_map.yaml' ||
  file.name === 'channel_map.yml' ||
  file.name.endsWith('channel_map.yaml') ||
  file.name.endsWith('channel_map.yml');

const getDataFileExtension = (file: File): '.csv' | '.rsp' | null => {
  const filename = file.name.toLowerCase();
  if (filename.endsWith('.csv')) return '.csv';
  if (filename.endsWith('.rsp')) return '.rsp';
  return null;
};

const DYNAMIC_LABEL_OVERRIDES: Record<string, string> = {
  'FGAWR Range (lbs)': 'FGAWR (lbs)',
  'RGAWR Range (lbs)': 'RGAWR (lbs)',
};

// Column-width defaults are derived from the longest known value per column.
// CHAR_PX/PADDING_PX are tuned for the table's text-xs cells (sort arrow +
// filter icon + horizontal padding).
const CHAR_PX = 7.2;
const PADDING_PX = 32;
const MIN_COLUMN_PX = 80;
const MAX_COLUMN_PX = 400;
// Default Job ID column width; matches the right edge of the leaf
// event-name cell so header labels align with leaf data on first paint.
const PROGRAM_ID_DEFAULT_PX = 250;
const PROGRAM_ID_KEY = 'programId';

const widthForValues = (label: string, values: string[]): number => {
  const longest = values.reduce(
    (max, v) => Math.max(max, v.length),
    label.length,
  );
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
};

type SortField = string;
type SortDirection = 'asc' | 'desc';

export default function DatabasePage() {
  const router = useRouter();
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.role === 'admin';
  const canWrite = useAuthStore(selectCanWrite);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (authStatus === 'authenticated' && !canWrite) {
      router.replace('/dashboard');
    }
  }, [authStatus, canWrite, router]);
  
  // Fetch filter options from server
  const [filterOptions, setFilterOptions] =
    useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);

  useEffect(() => {
    dashboardApi
      .getFilterOptions()
      .then(setFilterOptions)
      .catch(() => {
        // Use defaults on error
      });
  }, []);

  // Use hooks for data management
  const {
    datasets: rawDatasets,
    isLoading: isDatasetsLoading,
    isRefreshing: isDatasetsRefreshing,
    refetch: refetchDatasets,
    deleteDatasets,
    isDeletingIds,
    total,
    facets,
    programVersions,
  } = useUploadedDatasets({
    onError: (error) => toast.error(error),
  });

  const datasets = rawDatasets;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    'Program ID': '',
    'Load Version': '',
    'Job Number': '',
    'Work Order': '',
    GVW: '',
    FGAWR: '',
    RGAWR: '',
    Status: 'Pending',
  });
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);

  const dbOperation = useDatabaseOperation({
    currentEventCount: total,
    onImportComplete: () => {
      dashboardApi
        .getFilterOptions()
        .then(setFilterOptions)
        .catch(() => setFilterOptions(DEFAULT_FILTER_OPTIONS));
      setFilters({
        'Program ID': '',
        'Load Version': '',
        'Job Number': '',
        'Work Order': '',
        GVW: '',
        FGAWR: '',
        RGAWR: '',
        Status: 'Pending',
      });
      setSelectedDatasets([]);
      clearAllColumnFilters();
      refetchDatasets();
      // A DB import replaces/augments the underlying dim_event rows, so
      // every cached view that derives from those rows must be rebuilt.
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      queryClient.invalidateQueries({ queryKey: ['program-ids'] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      queryClient.invalidateQueries({ queryKey: ['filter-options'] });
      queryClient.invalidateQueries({ queryKey: ['event-catalog'] });
    },
  });

  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
    suspension_component: [],
    axle_location: [],
    gross_vehicle_weight_range_lbs: [],
    drive_type: [],
    material_construction: [],
    steering_position: [],
    vehicle_type: [],
    status: [],
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    work_order: true,
    job_number: true,
    suspension_component: true,
    axle_location: true,
    gross_vehicle_weight_range_lbs: true,
    drive_type: true,
    material_construction: true,
    steering_position: true,
    vehicle_type: true,
    status: true,
  });

  const staticColumnDefinitions = [
    { key: 'work_order', label: 'Work Order' },
    { key: 'job_number', label: 'Program ID' },
    { key: 'suspension_component', label: 'Component' },
    { key: 'axle_location', label: 'Axle Location' },
    { key: 'gross_vehicle_weight_range_lbs', label: 'GVW (lbs)' },
    { key: 'drive_type', label: 'Drive Type' },
    { key: 'material_construction', label: 'Material' },
    { key: 'steering_position', label: 'L/R' },
    { key: 'vehicle_type', label: 'Vehicle Type' },
  ] as const;
  const coveredMetadataColumns = useMemo(
    () =>
      new Set([
        'work_order',
        'job_number',
        'suspension_component',
        'axle_location',
        'gross_vehicle_weight_range_lbs',
        'drive_type',
        'material_construction',
        'steering_position',
        'vehicle_type',
        'status',
      ]),
    []
  );
  const dynamicMetadataColumns = useMemo(
    () =>
      Object.entries(filterOptions)
        .filter(([, config]) => config.source !== 'custom')
        .filter(([, config]) => !coveredMetadataColumns.has(config.column))
        .sort((a, b) => a[1].order - b[1].order)
        .map(([displayName, config]) => ({
          key: config.column,
          label: DYNAMIC_LABEL_OVERRIDES[displayName] ?? displayName,
        })),
    [coveredMetadataColumns, filterOptions]
  );
  const defaultHiddenMetadataColumns = useMemo(
    () => new Set(['rfq', 'dv', 'pv', 'post_prod']),
    []
  );
  const columnDefinitions = useMemo(
    () => [
      ...staticColumnDefinitions,
      ...dynamicMetadataColumns,
      { key: 'status', label: 'Status' },
    ],
    [dynamicMetadataColumns]
  );
  const toggleableColumnDefinitions = useMemo(
    () => columnDefinitions.filter((column) => column.key !== 'status'),
    [columnDefinitions]
  );

  useEffect(() => {
    if (dynamicMetadataColumns.length === 0) {
      return;
    }
    setColumnFilters((prev) => {
      const next = { ...prev };
      dynamicMetadataColumns.forEach((column) => {
        if (!next[column.key]) {
          next[column.key] = [];
        }
      });
      return next;
    });
    setVisibleColumns((prev) => {
      const next = { ...prev };
      dynamicMetadataColumns.forEach((column) => {
        if (!(column.key in next)) {
          next[column.key] = !defaultHiddenMetadataColumns.has(column.key);
        }
      });
      return next;
    });
  }, [defaultHiddenMetadataColumns, dynamicMetadataColumns]);

  const getColumnValue = useCallback((dataset: DatasetInfo, columnKey: string): string => {
    const value = (dataset as unknown as Record<string, unknown>)[columnKey];
    if (typeof value === 'boolean') {
      return value ? 'Applicable' : 'Not Applicable';
    }
    return typeof value === 'string' ? value : '';
  }, []);

  const handleColumnVisibilityToggle = (columnKey: string, checked: boolean) => {
    if (columnKey === 'status') {
      return;
    }
    const currentVisibleCount = Object.values(visibleColumns).filter(Boolean).length;
    
    // Prevent unchecking if it would leave no columns visible
    if (!checked && currentVisibleCount <= 1) {
      toast.error('At least one column must be visible');
      return;
    }
    
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked }));
  };

  // Upload hook
  const {
    upload,
    isUploading,
    progress: uploadProgress,
    message: uploadMessage,
    cancel: cancelUpload,
  } = useUpload({
    onComplete: (response) => {
      toast.success(
        response.pending_channel_map
          ? 'Files uploaded and are pending channel map setup'
          : 'Files uploaded successfully'
      );
      setSelectedFiles([]);
      clearFilters();
      refetchDatasets();
      // A successful upload introduces new program_ids/versions; invalidate
      // every cache that derives from the dim_event rows so the Edit
      // Metadata dropdown and Dashboard immediately see the new data.
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      queryClient.invalidateQueries({ queryKey: ['program-ids'] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      queryClient.invalidateQueries({ queryKey: ['filter-options'] });
      queryClient.invalidateQueries({ queryKey: ['event-catalog'] });
    },
    onError: (error) => toast.error(`Upload failed: ${error}`),
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const programId = filters['Program ID'];
    const version = filters['Load Version'];
    const jobNumber = filters['Job Number'];
    const workOrder = filters['Work Order'];
    const statusValue = filters['Status'];

    // Validate mandatory fields
    if (!programId) {
      toast.error('Please enter a Job ID');
      return;
    }
    if (!version) {
      toast.error('Please enter a Load Version');
      return;
    }
    if (!jobNumber) {
      toast.error('Please enter a Program ID');
      return;
    }
    if (!workOrder) {
      toast.error('Please enter a Work Order');
      return;
    }

    const channelMapFile = selectedFiles.find(isChannelMapFile);

    const dataFiles = selectedFiles.filter((file) => getDataFileExtension(file) !== null);

    if (dataFiles.length === 0) {
      toast.error('No CSV or RSP files found');
      return;
    }

    const dataExtensions = new Set(dataFiles.map(getDataFileExtension));
    if (dataExtensions.size > 1) {
      toast.error('Upload either CSV files or RSP files, not both');
      return;
    }

    const ignoredCount = selectedFiles.filter(
      (file) => getDataFileExtension(file) === null && !isChannelMapFile(file),
    ).length;
    if (ignoredCount > 0) {
      toast.info(`${ignoredCount} unrelated file${ignoredCount === 1 ? '' : 's'} will be ignored`);
    }

    const metadataPayload: UploadMetadata = {
      program_id: programId,
      version,
      job_number: jobNumber,
      work_order: workOrder,
    };
    const optionalFieldMap = {
      'Suspension Component': 'suspension_component',
      'Axle Location': 'axle_location',
      GVW: 'gvw',
      FGAWR: 'fgawr',
      RGAWR: 'rgawr',
      'Drive Type': 'drive_type',
      "Mat'l & Const": 'material_construction',
      Material: 'material_construction',
      Steering: 'steering_position',
      'Steering Position': 'steering_position',
      'Damper Type': 'damper_type',
      'Vehicle Type': 'vehicle_type',
    } as const;
    Object.entries(optionalFieldMap).forEach(([displayName, metadataKey]) => {
      const value = filters[displayName]?.trim();
      if (value) {
        metadataPayload[metadataKey] = value;
      }
    });
    if (isAdmin && statusValue?.trim()) {
      metadataPayload.status = statusValue.trim();
    }

    await upload(dataFiles, channelMapFile, {
      ...metadataPayload,
    });
  };

  const handleCancelUpload = () => {
    cancelUpload();
    toast.info('Upload cancelled');
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      'Program ID': '',
      'Load Version': '',
      'Job Number': '',
      'Work Order': '',
      GVW: '',
      FGAWR: '',
      RGAWR: '',
      Status: 'Pending',
    });
  };

  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) =>
      key === 'Status' ? value !== '' && value !== 'Pending' : value !== ''
    );
  };

  // Count missing required fields for upload validation
  const missingFieldsCount = useMemo(() => {
    return REQUIRED_UPLOAD_FIELDS.filter((field) => !filters[field]).length;
  }, [filters]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getUniqueValues = useMemo(() => {
    const uniqueValues: Record<string, string[]> = {};
    columnDefinitions.forEach((column) => {
      if (facets[column.key]) {
        uniqueValues[column.key] = facets[column.key];
      } else {
        const values = new Set<string>();
        datasets.forEach((ds) => {
          const value = getColumnValue(ds, column.key);
          if (value && value !== '') values.add(value);
        });
        uniqueValues[column.key] = Array.from(values).sort();
      }
    });
    return uniqueValues;
  }, [columnDefinitions, datasets, facets, getColumnValue]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((dataset) => {
      for (const [column, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues.length === 0) continue;
        const datasetValue = getColumnValue(dataset, column);
        if (!selectedValues.includes(datasetValue)) return false;
      }
      return true;
    });
  }, [columnFilters, datasets, getColumnValue]);

  const sortedDatasets = useMemo(() => {
    return [...filteredDatasets].sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      if (sortField === 'created_at') {
        valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else {
        valueA = getColumnValue(a, sortField);
        valueB = getColumnValue(b, sortField);
      }

      const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortMultiplier * valueA.localeCompare(valueB);
      }
      return sortMultiplier * (valueA > valueB ? 1 : valueA < valueB ? -1 : 0);
    });
  }, [filteredDatasets, getColumnValue, sortField, sortDirection]);

  const handleColumnFilterChange = (
    column: string,
    value: string,
    checked: boolean
  ) => {
    setColumnFilters((prev) => {
      const currentFilters = prev[column] || [];
      if (checked) {
        return { ...prev, [column]: [...currentFilters, value] };
      }
      return { ...prev, [column]: currentFilters.filter((v) => v !== value) };
    });
  };

  const clearAllColumnFilters = () => {
    setColumnFilters((prev) => {
      const next: Record<string, string[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = [];
      });
      return next;
    });
  };

  const handleBatchSelect = (eventIds: string[], checked: boolean) => {
    setSelectedDatasets((prev) => {
      const prevSet = new Set(prev);
      if (checked) {
        eventIds.forEach((id) => prevSet.add(id));
      } else {
        eventIds.forEach((id) => prevSet.delete(id));
      }
      return [...prevSet];
    });
  };

  const parseSelectedScopes = useCallback(() => {
    const programScopes: string[] = [];
    const versionScopes: Array<{ program_id: string; version: string }> = [];
    const eventIds: string[] = [];
    for (const key of selectedDatasets) {
      if (key.startsWith(PROGRAM_SCOPE_PREFIX)) {
        programScopes.push(key.slice(PROGRAM_SCOPE_PREFIX.length));
        continue;
      }
      if (key.startsWith(VERSION_SCOPE_PREFIX)) {
        const raw = key.slice(VERSION_SCOPE_PREFIX.length);
        const [program_id, version] = raw.split('::');
        if (program_id && version) {
          versionScopes.push({ program_id, version });
        }
        continue;
      }
      eventIds.push(key);
    }
    return { programScopes, versionScopes, eventIds };
  }, [selectedDatasets]);

  const handleDeleteSelected = async () => {
    if (!authUser) return;
    if (selectedDatasets.length === 0) {
      toast.error('No datasets selected');
      return;
    }

    const { programScopes, versionScopes, eventIds } = parseSelectedScopes();
    const programScopeSet = new Set(programScopes);
    const effectiveVersionScopes = versionScopes.filter(
      (item) => !programScopeSet.has(item.program_id)
    );
    const hasScopeDeletes = programScopes.length > 0 || effectiveVersionScopes.length > 0;
    const scopeCount = programScopes.length + effectiveVersionScopes.length;
    const confirmation = hasScopeDeletes
      ? `Permanently delete ${scopeCount} program/version scope${
          scopeCount === 1 ? '' : 's'
        }? This removes processed events, measurements, channel maps, retained artifacts, and artifact files.`
      : `Delete ${eventIds.length} datasets? This cannot be undone.`;

    if (!confirm(confirmation)) {
      return;
    }

    let success = true;
    let deletedEventCount = 0;
    let deletedArtifactCount = 0;
    try {
      for (const programId of programScopes) {
        const result = await uploadApi.deleteProgramVersionScope({ program_id: programId });
        deletedEventCount += result.event_count;
        deletedArtifactCount += result.artifact_count;
      }
      for (const scope of effectiveVersionScopes) {
        const result = await uploadApi.deleteProgramVersionScope(scope);
        deletedEventCount += result.event_count;
        deletedArtifactCount += result.artifact_count;
      }
    } catch (error) {
      success = false;
      const message = error instanceof Error ? error.message : 'Failed to delete program/version scope';
      toast.error(message.includes('another user') ? 'Contact an admin to delete data owned by another user.' : message);
    }

    if (success && eventIds.length > 0) {
      success = await deleteDatasets(eventIds);
      deletedEventCount += eventIds.length;
    }

    if (success) {
      setSelectedDatasets([]);
      toast.success(
        hasScopeDeletes
          ? `Deleted ${scopeCount} scope${scopeCount === 1 ? '' : 's'} (${deletedEventCount} events, ${deletedArtifactCount} artifacts)`
          : `Deleted ${eventIds.length} datasets`
      );
      // Deletes change which program_ids/versions exist in the database.
      // Invalidate the TanStack Query caches that other pages (Edit
      // Metadata, Dashboard) read from so they don't keep offering a
      // version that no longer has any live events, and refetch this
      // page so the tree's program/version summary refreshes too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['program-ids'] }),
        queryClient.invalidateQueries({ queryKey: ['versions'] }),
        queryClient.invalidateQueries({ queryKey: ['filter-options'] }),
        queryClient.invalidateQueries({ queryKey: ['all-events'] }),
        queryClient.invalidateQueries({ queryKey: ['event-catalog'] }),
      ]);
      refetchDatasets();
      dashboardApi
        .getFilterOptions()
        .then(setFilterOptions)
        .catch(() => {
          // Keep existing options on failure
        });
    }
  };

  const handleExportDatabase = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    await dbOperation.startExport();
  };

  const handleImportClick = () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    dbOperation.openImport();
  };

  const renderFilterableColumnHeader = (
    label: string,
    field: SortField,
    width: number,
  ) => (
    <div
      key={field}
      className="relative shrink-0 px-2"
      style={{ width }}
    >
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => handleSort(field)}
          className="flex items-center justify-center gap-1 hover:text-foreground transition-colors text-center min-w-0"
        >
          <span className="truncate">{label}</span>
          {sortField === field && (
            <span className="text-primary shrink-0">
              {sortDirection === 'asc' ? (
                <ArrowUpIcon size={10} />
              ) : (
                <ArrowDownIcon size={10} />
              )}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`shrink-0 p-1 rounded hover:bg-accent transition-colors ${
                columnFilters[field]?.length > 0 
                  ? 'text-primary' 
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <FilterIcon size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 max-h-[280px] overflow-y-auto rounded-lg shadow-lg"
          >
            {getUniqueValues[field]?.length > 0 ? (
              getUniqueValues[field].map((value) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={columnFilters[field]?.includes(value) || false}
                  onCheckedChange={(checked: boolean) =>
                    handleColumnFilterChange(field, value, checked)
                  }
                  className="text-xs"
                >
                  {value}
                </DropdownMenuCheckboxItem>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No values
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ColumnResizeHandle
        width={width}
        onResize={(next) => setColumnWidth(field, next)}
      />
    </div>
  );

  const visibleColumnDefs = useMemo(
    () => columnDefinitions.filter((col) => visibleColumns[col.key]),
    [columnDefinitions, visibleColumns],
  );

  // Pixel widths per column (session-only). Seeded once per column id from
  // the longest known value in filterOptions; user resizes are preserved.
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      if (next[PROGRAM_ID_KEY] === undefined) {
        next[PROGRAM_ID_KEY] = PROGRAM_ID_DEFAULT_PX;
        changed = true;
      }
      for (const col of columnDefinitions) {
        if (next[col.key] !== undefined) continue;
        const entry = Object.values(filterOptions).find(
          (o) => o.column === col.key,
        );
        next[col.key] = widthForValues(col.label, entry?.values ?? []);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [columnDefinitions, filterOptions]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidths((prev) =>
      prev[key] === next ? prev : { ...prev, [key]: next },
    );
  }, []);

  const dataColumnsTotalWidth = useMemo(
    () =>
      visibleColumnDefs.reduce(
        (sum, col) => sum + (columnWidths[col.key] ?? MIN_COLUMN_PX),
        0,
      ),
    [visibleColumnDefs, columnWidths],
  );
  const programIdWidth = columnWidths[PROGRAM_ID_KEY] ?? PROGRAM_ID_DEFAULT_PX;
  const totalRowWidth = programIdWidth + dataColumnsTotalWidth;

  if (authStatus === 'loading' || authStatus === 'idle') {
    return <main className="flex-1 p-4">Loading...</main>;
  }

  return (
    <main className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">

        {/* Side Panel */}
        <DatabaseSidePanel
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed(!sidePanelCollapsed)}
          uploadDataProps={{
            selectedFiles,
            onFilesChange: setSelectedFiles,
            isUploading,
            uploadProgress,
            uploadMessage,
            onUpload: handleUpload,
            onCancelUpload: handleCancelUpload,
            filters,
            onFilterChange: (key: string, value: string) => handleFilterChange(key, value),
            filterOptions,
            isAdmin,
            hasActiveFilters: hasActiveFilters(),
            onClearFilters: clearFilters,
            missingFieldsCount,
          }}
          databaseProps={{
            isExporting: dbOperation.isExporting,
            isImporting: dbOperation.isImporting,
            isImportBusy: dbOperation.isImportBusy,
            currentEventCount: total,
            exportProgress: dbOperation.exportProgress || undefined,
            onExportDatabase: handleExportDatabase,
            onImportClick: handleImportClick,
          }}
        />

        <DatabaseOperationModal {...dbOperation.modalProps} />

        {/* Right Panel - Data Table */}
        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            {/* Table Header */}
            <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-b">
              {isDatasetsRefreshing && (
                <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Refreshing datasets...
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 gap-2"
                  >
                    <Columns className="h-4 w-4" />
                    <span className="text-xs">Columns</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold">Column Visibility</div>
                    <div className="space-y-2 bg-muted/70 rounded-md p-2">
                      {toggleableColumnDefinitions.map((col) => {
                        const isChecked = visibleColumns[col.key];
                        const isDisabled = false; // Allow all columns to be visible
                        
                        return (
                          <div
                            key={col.key}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={col.key}
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleColumnVisibilityToggle(col.key, checked as boolean)
                              }
                              disabled={isDisabled}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <label
                              htmlFor={col.key}
                              className={`text-xs cursor-pointer flex-1 ${
                                isDisabled ? 'text-muted-foreground opacity-50' : ''
                              }`}
                            >
                              {col.label}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {Object.values(visibleColumns).filter(Boolean).length} columns visible
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedDatasets.length === 0 || isDeletingIds.length > 0}
                className={`h-8 rounded-lg px-3 gap-2 ${selectedDatasets.length > 0 ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : ''}`}
              >
                {isDeletingIds.length > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span className="text-xs">Delete</span>
                  </>
                )}
              </Button>
            </div>

            {/* Tree Content (single horizontal-scroll container shared by
                header + rows so columns line up regardless of scroll). */}
            <CardContent className="flex-1 min-h-0 overflow-auto p-0">
              {programVersions.length > 0 ? (
                <div style={{ minWidth: totalRowWidth }}>
                  <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
                    <div
                      className="relative flex items-center gap-2 shrink-0 pl-1"
                      style={{ width: programIdWidth }}
                    >
                      <span>Job ID</span>
                      <ColumnResizeHandle
                        width={programIdWidth}
                        onResize={(next) => setColumnWidth(PROGRAM_ID_KEY, next)}
                      />
                    </div>
                    <div className="flex items-center">
                      {visibleColumnDefs.map((col) =>
                        renderFilterableColumnHeader(
                          col.label,
                          col.key,
                          columnWidths[col.key] ?? MIN_COLUMN_PX,
                        ),
                      )}
                    </div>
                  </div>
                  <DatabaseEventTree
                    datasets={sortedDatasets}
                    programVersions={programVersions}
                    selectedDatasets={selectedDatasets}
                    onBatchSelect={handleBatchSelect}
                    isDeletingIds={isDeletingIds}
                    columnDefinitions={visibleColumnDefs}
                    getColumnValue={getColumnValue}
                    columnWidths={columnWidths}
                    programIdWidth={programIdWidth}
                  />
                </div>
              ) : isDatasetsLoading || isDatasetsRefreshing ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-xs text-muted-foreground">
                    Refreshing datasets...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    No datasets yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-[280px]">
                    Upload CSV or RSP files with a
                    channel_map.yaml to get started.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
