'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Clipboard,
  ClipboardPaste,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { selectCanWrite, useAuthStore } from '@/stores/auth-store';
import { useFilterOptions } from '@/hooks/use-filter-options';
import type { ChannelMapEditorEntry, EventMetadata, FilterOptions } from '@/types/api';
import { dashboardApi } from '@/lib/api';
import { getPlotDisplayTitle } from '@/config/constants';
import { SidePanelLayout } from '@/components/shared';
import { ScrollArea } from '@/components/ui/scroll-area';

type MetadataDraftValues = Record<string, string>;
type PhaseDraftValues = {
  rfq: boolean;
  dv: boolean;
  pv: boolean;
  post_prod: boolean;
};
type SelectionMetadata = {
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  status: string | null;
};

const RAW_WEIGHT_FIELDS = [
  { key: 'gvw', label: 'GVW (lbs)' },
  { key: 'fgawr', label: 'FGAWR (lbs)' },
  { key: 'rgawr', label: 'RGAWR (lbs)' },
] as const;

const PHASE_FIELDS = [
  { key: 'rfq', label: 'RFQ' },
  { key: 'dv', label: 'DV' },
  { key: 'pv', label: 'PV' },
  { key: 'post_prod', label: 'Post-Prod' },
] as const;

const FIXED_CHANNEL_MAP_PLOTS = [
  'bj_xy_force_plot',
  'bj_xz_force_plot',
  'shock_xy_force_plot',
  'shock_xz_force_plot',
  'bushing_f_xy_force_plot',
  'bushing_f_xz_force_plot',
  'bushing_r_xy_force_plot',
  'bushing_r_xz_force_plot',
] as const;

const DEFAULT_CHANNEL_MAP_DRAFT: Record<string, { x_col: string; y_col: string }> =
  Object.fromEntries(FIXED_CHANNEL_MAP_PLOTS.map((plotKey) => [plotKey, { x_col: '', y_col: '' }]));

const EXCLUDED_METADATA_COLUMNS = new Set([
  'rfq',
  'dv',
  'pv',
  'post_prod',
  'gross_vehicle_weight_range_lbs',
  'fgawr_range_lbs',
  'rgawr_range_lbs',
]);

function toTimestamp(value: string | undefined | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toClearedDraftValues(options: FilterOptions): MetadataDraftValues {
  const nextDrafts: MetadataDraftValues = {};
  for (const [displayName] of Object.entries(options)) {
    nextDrafts[displayName] = '';
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    nextDrafts[field.label] = '';
  }
  return nextDrafts;
}

function toClearedPhaseDraftValues(): PhaseDraftValues {
  return {
    rfq: false,
    dv: false,
    pv: false,
    post_prod: false,
  };
}

function buildProgramVersionDraftValues(
  options: FilterOptions,
  events: EventMetadata[]
): { draft: MetadataDraftValues; baseline: MetadataDraftValues } {
  const draft: MetadataDraftValues = {};
  const baseline: MetadataDraftValues = {};

  const resolveField = (key: string, rawValues: (string | null | undefined)[]) => {
    const values = new Set<string>();
    let hasEmpty = false;
    for (const raw of rawValues) {
      const normalized = typeof raw === 'string' ? raw.trim() : '';
      if (normalized) {
        values.add(normalized);
      } else {
        hasEmpty = true;
      }
    }
    if (values.size === 1 && !hasEmpty) {
      draft[key] = Array.from(values)[0];
      baseline[key] = Array.from(values)[0];
      return;
    }
    if (values.size === 1 && hasEmpty) {
      // Some events have the value, others are null. Show the value so the
      // user sees it, but keep baseline empty so clicking Save propagates
      // the value to the null events.
      draft[key] = Array.from(values)[0];
      baseline[key] = '';
      return;
    }
    draft[key] = '';
    baseline[key] = '';
  };

  for (const [displayName, config] of Object.entries(options)) {
    if (EXCLUDED_METADATA_COLUMNS.has(config.column)) {
      continue;
    }
    resolveField(
      displayName,
      events.map((event) => event[config.column as keyof EventMetadata] as string | null | undefined)
    );
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    resolveField(
      field.label,
      events.map((event) => event[field.key as keyof EventMetadata] as string | null | undefined)
    );
  }

  return { draft, baseline };
}

function buildProgramVersionPhaseDraftValues(events: EventMetadata[]): PhaseDraftValues {
  const fieldValues: PhaseDraftValues = toClearedPhaseDraftValues();
  for (const field of PHASE_FIELDS) {
    const allTrue = events.every((event) => Boolean(event[field.key as keyof EventMetadata]));
    fieldValues[field.key] = allTrue;
  }
  return fieldValues;
}

export default function FilterValuesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const canWrite = useAuthStore(selectCanWrite);
  const { data: serverOptions, isLoading } = useFilterOptions();
  const [draftValues, setDraftValues] = useState<MetadataDraftValues>({});
  const [baselineDraftValues, setBaselineDraftValues] = useState<MetadataDraftValues>(
    {}
  );
  const [phaseDraftValues, setPhaseDraftValues] = useState<PhaseDraftValues>(
    toClearedPhaseDraftValues()
  );
  const [baselinePhaseDraftValues, setBaselinePhaseDraftValues] =
    useState<PhaseDraftValues>(toClearedPhaseDraftValues());
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [dirtyPhases, setDirtyPhases] = useState<Set<keyof PhaseDraftValues>>(
    new Set(),
  );
  const [preResetSnapshot, setPreResetSnapshot] = useState<{
    values: MetadataDraftValues;
    phases: PhaseDraftValues;
    dirtyFields: Set<string>;
    dirtyPhases: Set<keyof PhaseDraftValues>;
  } | null>(null);
  const [copyClipboard, setCopyClipboard] = useState<MetadataDraftValues | null>(
    null,
  );
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingChannelMap, setIsSavingChannelMap] = useState(false);
  const [channelMapDraft, setChannelMapDraft] = useState(DEFAULT_CHANNEL_MAP_DRAFT);
  const [selectedEventMetadata, setSelectedEventMetadata] =
    useState<SelectionMetadata | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const dirtyPhasesRef = useRef<Set<keyof PhaseDraftValues>>(new Set());
  const isAdmin = authUser?.role === 'admin';

  const { data: programIdsData, isLoading: isProgramIdsLoading } = useQuery({
    queryKey: ['program-ids'],
    queryFn: () => dashboardApi.getProgramIds(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: versionsData, isLoading: isVersionsLoading } = useQuery({
    queryKey: ['versions', selectedProgramId],
    queryFn: () => dashboardApi.getVersions(selectedProgramId),
    enabled: Boolean(selectedProgramId),
    staleTime: 5 * 60 * 1000,
  });

  const programIds = programIdsData?.program_ids ?? [];
  const versions = versionsData?.versions ?? [];

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (authStatus === 'authenticated' && !canWrite) {
      router.replace('/dashboard');
    }
  }, [authStatus, canWrite, router]);

  const sortedOptions = useMemo(() => {
    if (!serverOptions) {
      return [];
    }

    return Object.entries(serverOptions).sort(
      (a, b) => a[1].order - b[1].order
    );
  }, [serverOptions]);
  const metadataOptions = useMemo(
    () =>
      sortedOptions.filter(
        ([, config]) =>
          config.source !== 'custom' && !EXCLUDED_METADATA_COLUMNS.has(config.column)
      ),
    [sortedOptions]
  );

  useEffect(() => {
    if (!serverOptions) {
      return;
    }

    const addMissingKeys = (prev: MetadataDraftValues): MetadataDraftValues => {
      const next = { ...prev };
      let changed = false;
      for (const displayName of Object.keys(serverOptions)) {
        if (!(displayName in next)) {
          next[displayName] = '';
          changed = true;
        }
      }
      for (const field of RAW_WEIGHT_FIELDS) {
        if (!(field.label in next)) {
          next[field.label] = '';
          changed = true;
        }
      }
      return changed ? next : prev;
    };

    setDraftValues(addMissingKeys);
    setBaselineDraftValues(addMissingKeys);
  }, [serverOptions]);

  const eventsQuery = useQuery({
    queryKey: ['program-version-events', selectedProgramId, selectedVersion],
    queryFn: () =>
      dashboardApi.getEvents(
        {
          program_ids: [selectedProgramId],
          versions: [selectedVersion],
          global_filters: {},
        },
        500,
      ),
    enabled: Boolean(selectedProgramId && selectedVersion && serverOptions),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const channelMapQuery = useQuery({
    queryKey: ['channel-map-editor', selectedProgramId, selectedVersion],
    queryFn: () => dashboardApi.getChannelMapEditor(selectedProgramId, selectedVersion),
    enabled: Boolean(selectedProgramId && selectedVersion),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const isPrefillLoading = eventsQuery.isFetching;

  useEffect(() => {
    dirtyFieldsRef.current = dirtyFields;
  }, [dirtyFields]);

  useEffect(() => {
    dirtyPhasesRef.current = dirtyPhases;
  }, [dirtyPhases]);

  useEffect(() => {
    if (!selectedProgramId || !selectedVersion || !serverOptions) {
      if (serverOptions) {
        const clearedDraft = toClearedDraftValues(serverOptions);
        setDraftValues(clearedDraft);
        setBaselineDraftValues(clearedDraft);
        const clearedPhases = toClearedPhaseDraftValues();
        setPhaseDraftValues(clearedPhases);
        setBaselinePhaseDraftValues(clearedPhases);
      }
      setPreResetSnapshot(null);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      setSelectedEventMetadata(null);
      lastInitKeyRef.current = null;
    }
  }, [selectedProgramId, selectedVersion, serverOptions]);

  useEffect(() => {
    if (eventsQuery.error) {
      const message =
        eventsQuery.error instanceof Error
          ? eventsQuery.error.message
          : 'Failed to prefill filter values for the selected program/version';
      toast.error(message);
      setSelectedEventMetadata(null);
    }
  }, [eventsQuery.error]);

  useEffect(() => {
    const data = channelMapQuery.data;
    if (!data) {
      setChannelMapDraft({ ...DEFAULT_CHANNEL_MAP_DRAFT });
      return;
    }
    const next = { ...DEFAULT_CHANNEL_MAP_DRAFT };
    for (const entry of data.entries) {
      next[entry.plot_key] = {
        x_col: String(entry.x_col),
        y_col: String(entry.y_col),
      };
    }
    setChannelMapDraft(next);
  }, [channelMapQuery.data]);

  useEffect(() => {
    const data = eventsQuery.data;
    if (!data || !serverOptions || !selectedProgramId || !selectedVersion) {
      return;
    }
    const key = `${selectedProgramId}::${selectedVersion}`;
    const isFreshSelection = lastInitKeyRef.current !== key;
    const matchingEvents = data.events;

    const { draft: nextDraftValues, baseline: nextBaselineValues } =
      buildProgramVersionDraftValues(serverOptions, matchingEvents);
    const nextPhaseDraftValues = buildProgramVersionPhaseDraftValues(matchingEvents);

    setBaselineDraftValues(nextBaselineValues);
    setBaselinePhaseDraftValues(nextPhaseDraftValues);

    if (isFreshSelection) {
      setDraftValues(nextDraftValues);
      setPhaseDraftValues(nextPhaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      setPreResetSnapshot(null);
    } else {
      const currentDirtyFields = dirtyFieldsRef.current;
      const currentDirtyPhases = dirtyPhasesRef.current;
      setDraftValues((prev) => {
        const next = { ...prev };
        for (const [fieldKey, value] of Object.entries(nextDraftValues)) {
          if (!currentDirtyFields.has(fieldKey)) {
            next[fieldKey] = value;
          }
        }
        return next;
      });
      setPhaseDraftValues((prev) => {
        const next = { ...prev };
        for (const field of PHASE_FIELDS) {
          if (!currentDirtyPhases.has(field.key)) {
            next[field.key] = nextPhaseDraftValues[field.key];
          }
        }
        return next;
      });
    }

    const uniqueStatusValues = new Set<string>();
    matchingEvents.forEach((event) => {
      const statusValue = event.status?.trim();
      if (statusValue) {
        uniqueStatusValues.add(statusValue);
      }
    });
    const latestUpdatedEvent = matchingEvents.reduce<EventMetadata | null>(
      (latest, event) => {
        const latestTs = toTimestamp(latest?.updated_at ?? latest?.created_at);
        const eventTs = toTimestamp(event.updated_at ?? event.created_at);
        return eventTs > latestTs ? event : latest;
      },
      null,
    );
    const latestUploadedEvent = matchingEvents.reduce<EventMetadata | null>(
      (latest, event) => {
        const latestTs = toTimestamp(latest?.created_at);
        const eventTs = toTimestamp(event.created_at);
        return eventTs > latestTs ? event : latest;
      },
      null,
    );
    setSelectedEventMetadata({
      lastUpdatedBy:
        latestUpdatedEvent?.last_updated_by_username ??
        latestUpdatedEvent?.last_updated_by_user_id ??
        latestUpdatedEvent?.uploaded_by_user_id ??
        null,
      lastUpdatedAt:
        latestUpdatedEvent?.updated_at ?? latestUpdatedEvent?.created_at ?? null,
      uploadedBy:
        latestUploadedEvent?.uploaded_by_username ??
        latestUploadedEvent?.uploaded_by_user_id ??
        null,
      uploadedAt: latestUploadedEvent?.created_at ?? null,
      status:
        uniqueStatusValues.size === 1
          ? Array.from(uniqueStatusValues)[0]
          : uniqueStatusValues.size > 1
            ? 'Mixed'
            : null,
    });

    lastInitKeyRef.current = key;
  }, [eventsQuery.data, serverOptions, selectedProgramId, selectedVersion]);

  const formatTimestamp = (value: string | null): string => {
    if (!value) {
      return 'N/A';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }
    return parsed.toLocaleString();
  };

  const markFieldDirty = (displayName: string) => {
    setDirtyFields((prev) => {
      if (prev.has(displayName)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(displayName);
      return next;
    });
  };
  const markPhaseDirty = (key: keyof PhaseDraftValues) => {
    setDirtyPhases((prev) => {
      if (prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const setValueForField = (displayName: string, rawValue: string) => {
    const value = rawValue.trim();
    setDraftValues((prev) => ({
      ...prev,
      [displayName]: value,
    }));
    markFieldDirty(displayName);
  };
  const setWeightFieldValue = (displayName: string, rawValue: string) => {
    const value = rawValue.replace(/[^0-9.]/g, '');
    setDraftValues((prev) => ({
      ...prev,
      [displayName]: value,
    }));
    markFieldDirty(displayName);
  };
  const setPhaseValue = (key: keyof PhaseDraftValues, nextValue: boolean) => {
    setPhaseDraftValues((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
    markPhaseDirty(key);
  };

  const getFieldSelectLabel = (displayName: string): string => {
    if (!selectedProgramId || !selectedVersion) {
      return 'Select Program & Version';
    }

    const value = draftValues[displayName]?.trim() ?? '';
    if (!value) {
      return 'N/A';
    }

    return value;
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    if (!selectedProgramId || !selectedVersion) {
      toast.error('Select Program ID and Version first');
      return;
    }

    const updates: Record<string, string | boolean | null> = {};
    metadataOptions.forEach(([displayName, config]) => {
      const isStatusField =
        displayName.toLowerCase() === 'status' || config.column === 'status';
      if (!isAdmin && isStatusField) {
        return;
      }
      if (!dirtyFields.has(displayName)) {
        return;
      }
      const nextValue = (draftValues[displayName] ?? '').trim();
      updates[config.column] = nextValue || null;
    });
    RAW_WEIGHT_FIELDS.forEach((field) => {
      if (!dirtyFields.has(field.label)) {
        return;
      }
      const nextValue = (draftValues[field.label] ?? '').trim();
      updates[field.key] = nextValue || null;
    });
    PHASE_FIELDS.forEach((field) => {
      if (!dirtyPhases.has(field.key)) {
        return;
      }
      updates[field.key] = phaseDraftValues[field.key];
    });

    const savingToastId = toast.loading(
      `Saving metadata for ${selectedProgramId} / ${selectedVersion}...`
    );
    setIsSaving(true);
    try {
      if (Object.keys(updates).length === 0) {
        toast.warning('No changes to save', { id: savingToastId });
        return;
      }
      const updateResult = await dashboardApi.updateProgramVersionMetadata({
        program_id: selectedProgramId,
        version: selectedVersion,
        updates,
      });
      const updatedEventCount = updateResult.updated_event_count;
      setSelectedEventMetadata({
        lastUpdatedBy:
          updateResult.last_updated_by_username ??
          updateResult.last_updated_by_user_id ??
          null,
        lastUpdatedAt: updateResult.last_updated_at ?? null,
        uploadedBy:
          updateResult.uploaded_by_username ??
          updateResult.uploaded_by_user_id ??
          null,
        uploadedAt: updateResult.uploaded_at ?? null,
        status: updateResult.status ?? null,
      });

      setBaselineDraftValues(draftValues);
      setBaselinePhaseDraftValues(phaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      await queryClient.invalidateQueries({ queryKey: ['program-version-events'] });
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
      await queryClient.invalidateQueries({ queryKey: ['event-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['all-events'] });
      await queryClient.invalidateQueries({ queryKey: ['versions'] });
      await queryClient.invalidateQueries({ queryKey: ['program-ids'] });
      toast.success(
        `Metadata saved for ${updatedEventCount} event${
          updatedEventCount === 1 ? '' : 's'
        }`,
        { id: savingToastId }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update metadata';
      toast.error(message, { id: savingToastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    try {
      setPreResetSnapshot({
        values: { ...draftValues },
        phases: { ...phaseDraftValues },
        dirtyFields: new Set(dirtyFields),
        dirtyPhases: new Set(dirtyPhases),
      });
      setDraftValues(baselineDraftValues);
      setPhaseDraftValues(baselinePhaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      toast.success('Metadata values reset');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset metadata values';
      toast.error(message);
    }
  };

  const handleRestore = () => {
    if (!preResetSnapshot) {
      return;
    }
    try {
      setDraftValues(preResetSnapshot.values);
      setPhaseDraftValues(preResetSnapshot.phases);
      setDirtyFields(new Set(preResetSnapshot.dirtyFields));
      setDirtyPhases(new Set(preResetSnapshot.dirtyPhases));
      setPreResetSnapshot(null);
      toast.success('Pre-reset values restored');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore metadata values';
      toast.error(message);
    }
  };

  const buildCopyableKeys = (): string[] => {
    const keys: string[] = [];
    metadataOptions.forEach(([displayName, config]) => {
      const isStatusField =
        displayName.toLowerCase() === 'status' || config.column === 'status';
      if (isStatusField) {
        return;
      }
      keys.push(displayName);
    });
    RAW_WEIGHT_FIELDS.forEach((field) => {
      keys.push(field.label);
    });
    return keys;
  };

  const handleCopy = () => {
    try {
      const snapshot: MetadataDraftValues = {};
      buildCopyableKeys().forEach((key) => {
        snapshot[key] = draftValues[key] ?? '';
      });
      setCopyClipboard(snapshot);
      toast.success('Values copied');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to copy metadata values';
      toast.error(message);
    }
  };

  const handlePaste = () => {
    if (!copyClipboard) {
      return;
    }
    try {
      const keys = buildCopyableKeys();
      setDraftValues((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          next[key] = copyClipboard[key] ?? '';
        });
        return next;
      });
      setDirtyFields((prev) => {
        const next = new Set(prev);
        keys.forEach((key) => next.add(key));
        return next;
      });
      setCopyClipboard(null);
      toast.success('Values pasted');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to paste metadata values';
      toast.error(message);
    }
  };

  const handleClearFields = () => {
    if (!selectedProgramId || !selectedVersion) {
      return;
    }
    try {
      const clearableKeys: string[] = [];
      metadataOptions.forEach(([displayName, config]) => {
        const isStatusField =
          displayName.toLowerCase() === 'status' || config.column === 'status';
        if (isStatusField) {
          return;
        }
        clearableKeys.push(displayName);
      });
      RAW_WEIGHT_FIELDS.forEach((field) => {
        clearableKeys.push(field.label);
      });
      setDraftValues((prev) => {
        const next = { ...prev };
        clearableKeys.forEach((key) => {
          next[key] = '';
        });
        return next;
      });
      setPhaseDraftValues(toClearedPhaseDraftValues());
      setDirtyFields((prev) => {
        const next = new Set(prev);
        clearableKeys.forEach((key) => next.add(key));
        return next;
      });
      setDirtyPhases((prev) => {
        const next = new Set(prev);
        PHASE_FIELDS.forEach((field) => next.add(field.key));
        return next;
      });
      toast.success('Metadata values cleared');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to clear metadata values';
      toast.error(message);
    }
  };

  const setChannelMapValue = (
    plotKey: string,
    axis: 'x_col' | 'y_col',
    value: string,
  ) => {
    const normalized = value.replace(/[^0-9]/g, '');
    setChannelMapDraft((prev) => ({
      ...prev,
      [plotKey]: {
        ...(prev[plotKey] ?? { x_col: '', y_col: '' }),
        [axis]: normalized,
      },
    }));
  };

  const handleSaveChannelMap = async () => {
    if (!selectedProgramId || !selectedVersion) {
      toast.error('Select Program ID and Version first');
      return;
    }
    const entries: ChannelMapEditorEntry[] = [];
    for (const plotKey of FIXED_CHANNEL_MAP_PLOTS) {
      const draft = channelMapDraft[plotKey];
      if (!draft?.x_col || !draft?.y_col) {
        toast.error(`Enter x_col and y_col for ${plotKey}`);
        return;
      }
      entries.push({
        plot_key: plotKey,
        x_col: Number(draft.x_col),
        y_col: Number(draft.y_col),
      });
    }

    const savingToastId = toast.loading(
      `Saving channel map for ${selectedProgramId} / ${selectedVersion}...`,
    );
    setIsSavingChannelMap(true);
    try {
      const result = await dashboardApi.saveChannelMap({
        program_id: selectedProgramId,
        version: selectedVersion,
        entries,
      });
      await queryClient.invalidateQueries({ queryKey: ['channel-map-editor'] });
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
      await queryClient.invalidateQueries({ queryKey: ['program-version-events'] });
      await queryClient.invalidateQueries({ queryKey: ['all-events'] });
      await queryClient.invalidateQueries({ queryKey: ['event-catalog'] });
      toast.success(
        `Channel map saved. Processed ${result.processed_count} file${
          result.processed_count === 1 ? '' : 's'
        }${result.failed_count ? `; ${result.failed_count} failed` : ''}.`,
        { id: savingToastId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save channel map';
      toast.error(message, { id: savingToastId });
    } finally {
      setIsSavingChannelMap(false);
    }
  };

  if (
    authStatus === 'loading' ||
    authStatus === 'idle' ||
    isLoading
  ) {
    return <div className="flex-1 p-4">Loading...</div>;
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <SidePanelLayout
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed((prev) => !prev)}
          expandedWidth="w-[320px]"
        >
          <ScrollArea className="flex-1 min-h-0 w-full">
            <div className="p-5 space-y-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Select Dataset</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit event metadata for the selected program/version.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Program ID</p>
                  <Select
                    value={selectedProgramId}
                    onValueChange={(value) => {
                      setSelectedProgramId(value);
                      setSelectedVersion('');
                      setSelectedEventMetadata(null);
                    }}
                    disabled={isProgramIdsLoading || isPrefillLoading || isSaving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select program ID" />
                    </SelectTrigger>
                    <SelectContent>
                      {programIds.map((programId) => (
                        <SelectItem key={programId} value={programId}>
                          {programId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Version</p>
                  <Select
                    value={selectedVersion}
                    onValueChange={(value) => {
                      setSelectedVersion(value);
                      setSelectedEventMetadata(null);
                    }}
                    disabled={
                      !selectedProgramId || isVersionsLoading || isPrefillLoading || isSaving
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-3 text-xs">
                <p className="font-medium text-foreground">Current Selection Summary</p>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Last update by:</span>{' '}
                    {selectedEventMetadata?.lastUpdatedBy ?? 'N/A'}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Last update time:</span>{' '}
                    {formatTimestamp(selectedEventMetadata?.lastUpdatedAt ?? null)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Uploaded by:</span>{' '}
                    {selectedEventMetadata?.uploadedBy ?? 'N/A'}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Uploaded time:</span>{' '}
                    {formatTimestamp(selectedEventMetadata?.uploadedAt ?? null)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Status:</span>{' '}
                    {selectedEventMetadata?.status ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleClearFields}
                  disabled={
                    isPrefillLoading ||
                    isSaving ||
                    !selectedProgramId ||
                    !selectedVersion
                  }
                  className="h-8 px-6 text-xs font-medium"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Clear
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SidePanelLayout>

        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            <Tabs defaultValue="filter-values" className="flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
                <TabsList className="w-fit">
                  <TabsTrigger value="filter-values">Edit Metadata</TabsTrigger>
                  <TabsTrigger value="custom-fields">Map Channels</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (copyClipboard ? handlePaste() : handleCopy())}
                    disabled={
                      isPrefillLoading || isSaving || !selectedProgramId || !selectedVersion
                    }
                  >
                    {copyClipboard ? (
                      <ClipboardPaste className="size-4" />
                    ) : (
                      <Clipboard className="size-4" />
                    )}
                    {copyClipboard ? 'Paste' : 'Copy'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (preResetSnapshot ? handleRestore() : handleReset())}
                    disabled={
                      isPrefillLoading || isSaving || !selectedProgramId || !selectedVersion
                    }
                  >
                    {preResetSnapshot ? (
                      <RotateCw className="size-4" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    {preResetSnapshot ? 'Restore' : 'Reset'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={
                      isPrefillLoading ||
                      isSaving ||
                      !selectedProgramId ||
                      !selectedVersion ||
                      (dirtyFields.size === 0 && dirtyPhases.size === 0)
                    }
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <TabsContent value="filter-values" className="flex-1 min-h-0 mt-0">
                <CardContent className="p-4">
                  {!serverOptions ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      No metadata fields available.
                    </div>
                  ) : (
                    <div className="flex gap-0">
                      {(() => {
                        const statusOption = metadataOptions.find(
                          ([displayName, config]) =>
                            displayName.toLowerCase() === 'status' || config.column === 'status'
                        );
                        const nonStatusOptions = metadataOptions.filter(
                          ([displayName, config]) =>
                            !(displayName.toLowerCase() === 'status' || config.column === 'status')
                        );
                        const mid = Math.ceil(nonStatusOptions.length / 2);
                        const leftItems = nonStatusOptions.slice(0, mid);
                        const rightItems = nonStatusOptions.slice(mid);
                        const steeringOption = nonStatusOptions.find(
                          ([displayName, config]) =>
                            displayName.toLowerCase() === 'steering' ||
                            config.column === 'steering'
                        );
                        const leftItemsWithoutSteering = leftItems.filter(
                          ([displayName, config]) =>
                            !(
                              displayName.toLowerCase() === 'steering' ||
                              config.column === 'steering'
                            )
                        );
                        const rightItemsWithoutSteering = rightItems.filter(
                          ([displayName, config]) =>
                            !(
                              displayName.toLowerCase() === 'steering' ||
                              config.column === 'steering'
                            )
                        );
                        const gvwField = RAW_WEIGHT_FIELDS.find((field) => field.key === 'gvw');
                        const rightWeightFields = RAW_WEIGHT_FIELDS.filter(
                          (field) => field.key !== 'gvw'
                        );

                        const renderField = ([displayName, config]: [string, { column: string; values: string[]; source?: string; order: number }]) => {
                          const isStatusField =
                            displayName.toLowerCase() === 'status' || config.column === 'status';
                          const hasMixedValues = !draftValues[displayName];
                          return (
                            <div
                              key={displayName}
                              className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Column: <span className="font-mono">{config.column}</span>
                                  </p>
                                </div>
                                <Select
                                  value={draftValues[displayName] || undefined}
                                  onValueChange={(value) => setValueForField(displayName, value)}
                                  disabled={
                                    (!isAdmin && isStatusField) ||
                                    !selectedProgramId ||
                                    !selectedVersion ||
                                    isSaving
                                  }
                                >
                                  <SelectTrigger className="h-8 w-44 text-xs">
                                    <SelectValue
                                      placeholder={
                                        hasMixedValues
                                          ? 'Mixed values (select to override)'
                                          : getFieldSelectLabel(displayName)
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="max-h-64">
                                    {config.values.length > 0 ? (
                                      config.values.map((optionValue) => (
                                        <SelectItem key={optionValue} value={optionValue}>
                                          {optionValue}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="__none__" disabled>
                                        No predefined options
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        };
                        const renderWeightField = (field: (typeof RAW_WEIGHT_FIELDS)[number]) => (
                          <div
                            key={field.key}
                            className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]"
                          >
                            <p className="text-sm font-medium">{field.label}</p>
                            <Input
                              value={draftValues[field.label] ?? ''}
                              onChange={(event) =>
                                setWeightFieldValue(field.label, event.target.value)
                              }
                              placeholder="Enter value"
                              disabled={!selectedProgramId || !selectedVersion || isSaving}
                              className="h-8 text-xs"
                              inputMode="decimal"
                            />
                          </div>
                        );

                        return (
                          <>
                            <div className="flex-1 min-w-0 space-y-4">
                              {statusOption && (
                                <div className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">{statusOption[0]}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Column: <span className="font-mono">{statusOption[1].column}</span>
                                    </p>
                                    <Select
                                      value={draftValues[statusOption[0]] || undefined}
                                      onValueChange={(value) => setValueForField(statusOption[0], value)}
                                      disabled={!isAdmin || !selectedProgramId || !selectedVersion || isSaving}
                                    >
                                      <SelectTrigger className="h-8 w-full text-xs">
                                        <SelectValue
                                          placeholder={
                                            draftValues[statusOption[0]]
                                              ? getFieldSelectLabel(statusOption[0])
                                              : 'Mixed values (select to override)'
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent position="popper" className="max-h-64">
                                        {statusOption[1].values.map((optionValue) => (
                                          <SelectItem key={optionValue} value={optionValue}>
                                            {optionValue}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {!isAdmin && (
                                      <p className="text-xs text-amber-600 dark:text-amber-400">
                                        Admin access is required to edit this field.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {leftItemsWithoutSteering.map(renderField)}
                              {steeringOption && renderField(steeringOption)}
                            </div>
                            <div className="hidden xl:block w-px bg-border mx-4 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-4">
                              <div className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]">
                                <p className="text-sm font-medium">Applicable Phases</p>
                                <div className="grid grid-cols-4 gap-2">
                                  {PHASE_FIELDS.map((phaseField) => (
                                    <label
                                      key={phaseField.key}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <Checkbox
                                        checked={phaseDraftValues[phaseField.key]}
                                        onCheckedChange={(checked) =>
                                          setPhaseValue(phaseField.key, Boolean(checked))
                                        }
                                        disabled={!selectedProgramId || !selectedVersion || isSaving}
                                      />
                                      <span>{phaseField.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              {rightWeightFields.map(renderWeightField)}
                              {gvwField && renderWeightField(gvwField)}
                              {rightItemsWithoutSteering.map(renderField)}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="custom-fields" className="flex-1 min-h-0 mt-0">
                <CardContent className="h-full min-h-0 p-4">
                  {!selectedProgramId || !selectedVersion ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Select a Program ID and Version to edit its channel map.
                    </div>
                  ) : channelMapQuery.isLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading channel map...
                    </div>
                  ) : (
                    <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="flex min-h-0 flex-col rounded-md border bg-card">
                        <div className="flex items-center justify-between border-b px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">Plot Column Mapping</p>
                            <p className="text-xs text-muted-foreground">
                              Zero-based CSV column indexes are required for all 8 plots.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => void handleSaveChannelMap()}
                            disabled={isSavingChannelMap || !channelMapQuery.data?.column_count}
                          >
                            {isSavingChannelMap ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="size-4" />
                                Save Map
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto">
                          <div className="sticky top-0 z-10 grid grid-cols-[1fr_96px_96px] gap-2 border-b bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
                            <span>Plot</span>
                            <span>x_col</span>
                            <span>y_col</span>
                          </div>
                          {FIXED_CHANNEL_MAP_PLOTS.map((plotKey) => {
                            const plotDisplayTitle = getPlotDisplayTitle(plotKey);
                            return (
                              <div
                                key={plotKey}
                                className="grid grid-cols-[1fr_96px_96px] items-center gap-2 border-b px-4 py-2"
                              >
                                <span className="truncate text-xs" title={plotDisplayTitle}>
                                  {plotDisplayTitle}
                                </span>
                                <Input
                                  value={channelMapDraft[plotKey]?.x_col ?? ''}
                                  onChange={(event) =>
                                    setChannelMapValue(plotKey, 'x_col', event.target.value)
                                  }
                                  inputMode="numeric"
                                  className="h-8 text-xs"
                                />
                                <Input
                                  value={channelMapDraft[plotKey]?.y_col ?? ''}
                                  onChange={(event) =>
                                    setChannelMapValue(plotKey, 'y_col', event.target.value)
                                  }
                                  inputMode="numeric"
                                  className="h-8 text-xs"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                          {channelMapQuery.data?.missing_channel_map && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="size-3.5" />
                              Channel map required before these files can be plotted.
                            </span>
                          )}
                          {!channelMapQuery.data?.missing_channel_map && (
                            <span>
                              {channelMapQuery.data?.has_channel_map
                                ? 'Existing channel map will be updated and retained artifacts reprocessed.'
                                : 'No retained artifacts are available for this selection.'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-col rounded-md border bg-card">
                        <div className="border-b px-4 py-3">
                          <p className="text-sm font-medium">CSV Preview</p>
                          <p className="text-xs text-muted-foreground">
                            First 20 lines from the first retained CSV artifact.
                          </p>
                        </div>
                        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre p-4 text-xs leading-5">
                          {(channelMapQuery.data?.preview_lines?.length ?? 0) > 0
                            ? channelMapQuery.data!.preview_lines.join('\n')
                            : 'No CSV preview available.'}
                        </pre>
                        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                          Columns detected: {channelMapQuery.data?.column_count ?? 0} - Pending:{' '}
                          {channelMapQuery.data?.pending_artifact_count ?? 0} - Failed:{' '}
                          {channelMapQuery.data?.failed_artifact_count ?? 0}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
