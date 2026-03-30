'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { SuggestionScoreIndicator } from './SuggestionScoreIndicator';
import type { UnitsTabData, UnitMapping, SelectOption } from './types';
import { sortByName } from './types';

type UnitFilter = 'unmapped' | 'mapped' | 'all';

const UNIT_FILTER_OPTIONS: SelectOption<UnitFilter>[] = [
  { value: 'unmapped', label: 'Unmapped' },
  { value: 'mapped', label: 'Mapped' },
  { value: 'all', label: 'All' },
];

interface UnitsTabProps {
  data: UnitsTabData;
  unitMaps: Record<string, UnitMapping>;
  setUnitMaps: React.Dispatch<React.SetStateAction<Record<string, UnitMapping>>>;
  createUnitChecked: Record<string, boolean>;
  setCreateUnitChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  unitSearch: string;
  setUnitSearch: (value: string) => void;
  unitFilter: UnitFilter;
  setUnitFilter: (value: UnitFilter) => void;
  grocyUnitOptions: SelectOption[];
  actionRunning: string | null;
  onAcceptAllSuggestions: () => void;
  onAcceptSuggestion: (id: string) => void;
  onNormalizeUnits: () => void;
  onUnmapUnit: (mappingId: string, mealieUnitId: string, mealieUnitName: string) => void;
}

export function UnitsTab({
  data,
  unitMaps,
  setUnitMaps,
  createUnitChecked,
  setCreateUnitChecked,
  unitSearch,
  setUnitSearch,
  unitFilter,
  setUnitFilter,
  grocyUnitOptions,
  actionRunning,
  onAcceptAllSuggestions,
  onAcceptSuggestion,
  onNormalizeUnits,
  onUnmapUnit,
}: UnitsTabProps) {
  const isRunning = !!actionRunning;
  const existingUnitMappingsByMealieUnitId = useMemo(
    () => new Map(data.existingUnitMappings.map(mapping => [mapping.mealieUnitId, mapping])),
    [data.existingUnitMappings],
  );
  const grocyUnitLabelById = useMemo(
    () => new Map(grocyUnitOptions.map(option => [option.value, option.label])),
    [grocyUnitOptions],
  );

  const filteredUnits = useMemo(() => {
    const sorted = sortByName(data.mealieUnits);
    const q = unitSearch.trim().toLowerCase();

    return sorted.filter(unit => {
      const persistedMapping = existingUnitMappingsByMealieUnitId.get(unit.id);

      if (unitFilter === 'mapped' && !persistedMapping) {
        return false;
      }

      if (unitFilter === 'unmapped' && persistedMapping) {
        return false;
      }

      if (!q) {
        return true;
      }

      const selectedGrocyUnitName = unitMaps[unit.id]?.grocyUnitId !== null
        ? grocyUnitLabelById.get(unitMaps[unit.id].grocyUnitId ?? -1) ?? ''
        : '';

      return unit.name.toLowerCase().includes(q)
        || unit.abbreviation.toLowerCase().includes(q)
        || selectedGrocyUnitName.toLowerCase().includes(q);
    });
  }, [data.mealieUnits, existingUnitMappingsByMealieUnitId, grocyUnitLabelById, unitFilter, unitMaps, unitSearch]);

  const unmappedUnitIds = useMemo(() =>
    Object.entries(unitMaps).filter(([, m]) => m.grocyUnitId === null).map(([id]) => id),
    [unitMaps],
  );

  const visibleUnmappedUnitIds = useMemo(() => {
    const unmappedSet = new Set(unmappedUnitIds);
    return filteredUnits.filter(u => unmappedSet.has(u.id)).map(u => u.id);
  }, [unmappedUnitIds, filteredUnits]);

  const allVisibleUnitsChecked = visibleUnmappedUnitIds.length > 0 && visibleUnmappedUnitIds.every(id => createUnitChecked[id]);
  const checkedUnitCount = unmappedUnitIds.filter(id => createUnitChecked[id]).length;
  const unitMappedCount = Object.values(unitMaps).filter(m => m.grocyUnitId !== null).length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3">
      {data.unmappedMealieUnits.length === 0 && (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle2 className="size-4 text-success" />
          <AlertDescription className="text-success">
            All Mealie units are mapped. Switch the filter to review or update existing mappings.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(data.unitSuggestions).length > 0 && (
          <Button variant="secondary" onClick={onAcceptAllSuggestions} disabled={isRunning}>
            Fill Suggestions... ({Object.keys(data.unitSuggestions).length})
          </Button>
        )}
        <Button variant="outline" onClick={onNormalizeUnits} disabled={isRunning}>
          Normalize (lowercase)
        </Button>
        <SearchableSelect
          options={UNIT_FILTER_OPTIONS}
          value={unitFilter}
          onChange={value => value && setUnitFilter(value)}
          ariaLabel="Filter units by mapping status"
          className="w-[140px]"
          clearable={false}
        />
        <Input
          placeholder="Filter Mealie units..."
          value={unitSearch}
          onChange={e => setUnitSearch(e.target.value)}
          className="max-w-[250px]"
        />
      </div>

      {/* Table */}
      <div className="min-h-0 min-w-0 flex-1 rounded-md border">
        <Table className="min-w-[820px]" containerClassName="h-full min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 text-center">
                <Checkbox
                  checked={allVisibleUnitsChecked}
                  onCheckedChange={(checked: boolean) => {
                    setCreateUnitChecked(prev => {
                      const next = { ...prev };
                      for (const id of visibleUnmappedUnitIds) next[id] = checked;
                      return next;
                    });
                  }}
                />
              </TableHead>
              <TableHead>Mealie Unit</TableHead>
              <TableHead>Abbr.</TableHead>
              <TableHead className="w-[40%]">Grocy Unit</TableHead>
              <TableHead className="w-[70px]">Match</TableHead>
              <TableHead className="w-[110px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  No units match the current filters.
                </TableCell>
              </TableRow>
            )}
            {filteredUnits.map(unit => {
              const mapping = unitMaps[unit.id];
              const suggestion = data.unitSuggestions[unit.id];
              const isAccepted = mapping?.grocyUnitId !== null;
              const persistedMapping = existingUnitMappingsByMealieUnitId.get(unit.id);
              const rowOptions = grocyUnitOptions.filter(option =>
                option.value === mapping?.grocyUnitId
                || !Object.values(unitMaps).some(other =>
                  other.mealieUnitId !== unit.id && other.grocyUnitId === option.value,
                ),
              );

              return (
                <TableRow key={unit.id} className={isAccepted ? 'bg-success/5' : undefined}>
                  <TableCell className="text-center">
                    {!isAccepted && (
                      <Checkbox
                        checked={!!createUnitChecked[unit.id]}
                        onCheckedChange={(checked: boolean) => setCreateUnitChecked(prev => ({ ...prev, [unit.id]: checked }))}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell className="text-muted-foreground">{unit.abbreviation || '-'}</TableCell>
                  <TableCell>
                    <SearchableSelect
                      options={rowOptions}
                      value={mapping?.grocyUnitId ?? null}
                      onChange={val => {
                        setUnitMaps(prev => ({ ...prev, [unit.id]: { ...prev[unit.id], grocyUnitId: val } }));
                        if (val !== null) {
                          setCreateUnitChecked(prev => { const next = { ...prev }; delete next[unit.id]; return next; });
                        }
                      }}
                      placeholder="Select Grocy unit..."
                      className="max-w-[280px]"
                      clearable={!persistedMapping}
                    />
                  </TableCell>
                  <TableCell>
                    {suggestion ? (
                      <SuggestionScoreIndicator
                        score={suggestion.score}
                        ambiguous={suggestion.ambiguous}
                        runnerUp={suggestion.runnerUp}
                        acceptTitle={`Accept: ${suggestion.grocyUnitName}`}
                        onAccept={!isAccepted ? () => onAcceptSuggestion(unit.id) : undefined}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {persistedMapping ? (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isRunning}
                        onClick={() => onUnmapUnit(persistedMapping.id, unit.id, unit.name)}
                      >
                        Unmap
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}
