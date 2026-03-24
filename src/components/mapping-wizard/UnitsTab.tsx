'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import type { WizardData, UnitMapping, SelectOption } from './types';
import { sortByName } from './types';

interface UnitsTabProps {
  data: WizardData;
  unitMaps: Record<string, UnitMapping>;
  setUnitMaps: React.Dispatch<React.SetStateAction<Record<string, UnitMapping>>>;
  createUnitChecked: Record<string, boolean>;
  setCreateUnitChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  unitSearch: string;
  setUnitSearch: (value: string) => void;
  grocyUnitOptions: SelectOption[];
  actionRunning: string | null;
  onAcceptAllSuggestions: () => void;
  onAcceptSuggestion: (id: string) => void;
}

export function UnitsTab({
  data,
  unitMaps,
  setUnitMaps,
  createUnitChecked,
  setCreateUnitChecked,
  unitSearch,
  setUnitSearch,
  grocyUnitOptions,
  actionRunning,
  onAcceptAllSuggestions,
  onAcceptSuggestion,
}: UnitsTabProps) {
  const isRunning = !!actionRunning;

  const filteredUnits = useMemo(() => {
    const sorted = sortByName(data.unmappedMealieUnits);
    if (!unitSearch) return sorted;
    const q = unitSearch.toLowerCase();
    return sorted.filter(u => u.name.toLowerCase().includes(q) || u.abbreviation.toLowerCase().includes(q));
  }, [data, unitSearch]);

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

  if (data.unmappedMealieUnits.length === 0) {
    return (
      <Alert className="border-success/30 bg-success/10">
        <CheckCircle2 className="size-4 text-success" />
        <AlertDescription className="text-success">
          All Mealie units are mapped. You can continue to the Products tab.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(data.unitSuggestions).length > 0 && (
          <Button variant="secondary" size="sm" onClick={onAcceptAllSuggestions} disabled={isRunning}>
            Accept All Suggestions ({Object.keys(data.unitSuggestions).length})
          </Button>
        )}
        <Input
          placeholder="Filter Mealie units..."
          value={unitSearch}
          onChange={e => setUnitSearch(e.target.value)}
          className="max-w-[250px]"
        />
      </div>

      {/* Table */}
      <ScrollArea className="max-h-[400px] rounded-md border">
        <Table>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.map(unit => {
              const mapping = unitMaps[unit.id];
              const suggestion = data.unitSuggestions[unit.id];
              const isAccepted = mapping?.grocyUnitId !== null;
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
                      options={grocyUnitOptions}
                      value={mapping?.grocyUnitId ?? null}
                      onChange={val => {
                        setUnitMaps(prev => ({ ...prev, [unit.id]: { ...prev[unit.id], grocyUnitId: val } }));
                        if (val !== null) {
                          setCreateUnitChecked(prev => { const next = { ...prev }; delete next[unit.id]; return next; });
                        }
                      }}
                      placeholder="Select Grocy unit..."
                      className="max-w-[280px]"
                    />
                  </TableCell>
                  <TableCell>
                    {suggestion && !isAccepted ? (
                      <button
                        className="cursor-pointer"
                        onClick={() => onAcceptSuggestion(unit.id)}
                        title={`Accept: ${suggestion.grocyUnitName}`}
                      >
                        <ScoreBadge score={suggestion.score} />
                      </button>
                    ) : suggestion ? (
                      <ScoreBadge score={suggestion.score} />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

    </div>
  );
}
