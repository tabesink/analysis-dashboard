'use client';

import { useState, useEffect, useCallback, useMemo, type MouseEvent } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  NON_GLOBAL_FILTER_FIELDS,
  SHORT_LABELS,
  type FilterField,
  type GlobalFilterChipField,
  isGlobalFiltersActive,
  normalizeFilters,
  upsertFilterValue,
  removeFilterField,
  buildCountsByField,
  buildActiveFilterChips,
  FilterSummaryBar,
  FilterOptionRow,
} from './global-filters';
import { SidePanelSection } from '@/components/shared';

export function GlobalFilters({
  isCollapsed = false,
  onExpand,
  forceExpanded = false,
  isActive = false,
}: {
  isCollapsed?: boolean;
  onExpand?: () => void;
  forceExpanded?: boolean;
  isActive?: boolean;
}) {
  const { globalFilters, setGlobalFilters } = useFilterState();
  const { allVisibleEvents, isLoading: loadingEvents } = useEventCatalog();
  const { data: filterOptions, isLoading: loadingOptions } = useFilterOptions();

  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const [eventIdSearchInput, setEventIdSearchInput] = useState(
    globalFilters.event_id_query ?? ''
  );

  const filterEntries = useMemo(
    () =>
      Object.entries(filterOptions ?? {})
        .filter(([, config]) => !NON_GLOBAL_FILTER_FIELDS.has(config.column))
        .sort((a, b) => a[1].order - b[1].order),
    [filterOptions]
  );

  const fieldNames = useMemo(
    () => filterEntries.map(([, config]) => config.column),
    [filterEntries]
  );

  const displayNameByField = useMemo(() => {
    const mapping: Record<string, string> = {};
    filterEntries.forEach(([displayName, config]) => {
      mapping[config.column] = displayName;
    });
    return mapping;
  }, [filterEntries]);

  const countsByField = useMemo(
    () => buildCountsByField(allVisibleEvents, fieldNames),
    [allVisibleEvents, fieldNames]
  );

  const activeFilters = useMemo(
    () => buildActiveFilterChips(globalFilters, displayNameByField),
    [globalFilters, displayNameByField]
  );

  const isFilterValueActive = useCallback(
    (field: FilterField, value: string) => {
      const values = Array.isArray(globalFilters[field]) ? globalFilters[field] : [];
      return values.includes(value);
    },
    [globalFilters]
  );

  const handleFilterToggle = useCallback(
    (field: FilterField, value: string) => {
      const values = Array.isArray(globalFilters[field]) ? globalFilters[field] : [];
      const isChecked = !values.includes(value);
      setGlobalFilters(upsertFilterValue(globalFilters, field, value, isChecked));
    },
    [globalFilters, setGlobalFilters]
  );

  const clearAllFilters = useCallback(() => {
    setGlobalFilters({});
  }, [setGlobalFilters]);

  const clearFilterField = useCallback(
    (fieldName: string, e?: MouseEvent) => {
      e?.stopPropagation();
      setGlobalFilters(removeFilterField(globalFilters, fieldName));
    },
    [globalFilters, setGlobalFilters]
  );

  const removeFilterChip = useCallback(
    (field: GlobalFilterChipField, value: string) => {
      if (field === 'event_id_query') {
        setEventIdSearchInput('');
        setGlobalFilters(normalizeFilters({ ...globalFilters, event_id_query: '' }));
        return;
      }
      setGlobalFilters(upsertFilterValue(globalFilters, field, value, false));
    },
    [globalFilters, setGlobalFilters]
  );

  useEffect(() => {
    setEventIdSearchInput(globalFilters.event_id_query ?? '');
  }, [globalFilters.event_id_query]);

  useEffect(() => {
    const nextQuery = eventIdSearchInput.trim();
    const currentQuery = (globalFilters.event_id_query ?? '').trim();
    if (nextQuery === currentQuery) return;

    const timer = setTimeout(() => {
      setGlobalFilters(normalizeFilters({ ...globalFilters, event_id_query: nextQuery }));
    }, 250);

    return () => clearTimeout(timer);
  }, [eventIdSearchInput, globalFilters, setGlobalFilters]);

  useEffect(() => {
    if (forceExpanded) {
      setOpenAccordions([]);
    }
  }, [forceExpanded]);

  const hasActiveFilters = isGlobalFiltersActive(globalFilters);
  const isLoading = loadingEvents || loadingOptions;

  if (isCollapsed) {
    const activeState = isActive !== undefined ? isActive : hasActiveFilters;
    return (
      <Button
        variant="ghost"
        onClick={onExpand}
        className={`p-2 rounded-lg transition-all ${
          activeState
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        aria-label="Expand Filter Data section"
        title="Filter Data"
      >
        <Filter className="h-4 w-4" />
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-24 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const filterSectionSubtitle =
    activeFilters.length === 0
      ? 'No filters selected - all events are shown.'
      : undefined;

  return (
    <SidePanelSection
      title="Filter Data"
      subtitle={filterSectionSubtitle}
      defaultExpanded={false}
      forceExpanded={forceExpanded}
      persistentContent={
        <>
          <FilterSummaryBar
            activeFilters={activeFilters}
            onRemove={removeFilterChip}
            onClearAll={clearAllFilters}
          />
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={eventIdSearchInput}
                onChange={(e) => setEventIdSearchInput(e.target.value)}
                placeholder="Search Event ID"
                className="h-8 pl-7 pr-7 text-xs placeholder:text-xs"
              />
              {eventIdSearchInput.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEventIdSearchInput('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear Event ID search"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </>
      }
    >
      <Accordion
        type="multiple"
        value={openAccordions}
        onValueChange={setOpenAccordions}
        className="w-full space-y-2"
      >
        {filterEntries.map(([displayName, config]) => {
          const fieldName = config.column;
          const options = filterOptions?.[displayName]?.values ?? [];
          const activeValues = Array.isArray(globalFilters[fieldName])
            ? globalFilters[fieldName]
            : [];
          const hasActiveValues = activeValues.length > 0;
          const shortLabel = SHORT_LABELS[displayName] || displayName;

          return (
            <AccordionItem key={displayName} value={displayName} className="border-b-0">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline hover:bg-muted/50 rounded-md bg-muted/30">
                <div className="flex items-center justify-between w-full">
                  <span>{shortLabel}</span>
                  {hasActiveValues && hasActiveFilters && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => clearFilterField(fieldName, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          clearFilterField(fieldName);
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer mr-2"
                    >
                      Clear
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="px-2 space-y-0">
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No options available</p>
                  ) : (
                    options.map((option) => {
                      const isSelected = isFilterValueActive(fieldName, option);
                      const totalCount = countsByField[fieldName]?.get(option) ?? 0;

                      return (
                        <FilterOptionRow
                          key={option}
                          option={option}
                          count={totalCount}
                          checked={isSelected}
                          onToggle={() => handleFilterToggle(fieldName, option)}
                        />
                      );
                    })
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </SidePanelSection>
  );
}
