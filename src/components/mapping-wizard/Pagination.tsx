'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { describePageRange, PAGE_SIZE_OPTIONS, type PageWindow } from './paging';

interface PaginationProps {
  window: PageWindow<unknown>;
  onOffsetChange: (offset: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
  /** Describes what is being counted, e.g. "products". Used for aria labels. */
  itemLabel: string;
}

export function Pagination({
  window,
  onOffsetChange,
  onPageSizeChange,
  disabled = false,
  itemLabel,
}: PaginationProps) {
  const { offset, pageSize, page, pageCount, hasPrevious, hasNext } = window;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground" aria-live="polite">
        Showing {describePageRange(window)} {itemLabel}
      </span>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Per page
          <NativeSelect
            value={pageSize}
            disabled={disabled}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            aria-label={`${itemLabel} per page`}
            containerClassName="w-[76px]"
          >
            {PAGE_SIZE_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </NativeSelect>
        </label>

        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasPrevious}
          onClick={() => onOffsetChange(offset - pageSize)}
          aria-label={`Previous page of ${itemLabel}`}
        >
          <ChevronLeft />
          Prev
        </Button>

        <span className="tabular-nums text-muted-foreground">
          Page {page} of {pageCount}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasNext}
          onClick={() => onOffsetChange(offset + pageSize)}
          aria-label={`Next page of ${itemLabel}`}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
