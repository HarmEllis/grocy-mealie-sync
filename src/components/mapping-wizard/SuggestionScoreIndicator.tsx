'use client';

import { AlertTriangle } from 'lucide-react';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SuggestionRunnerUp } from './types';

interface SuggestionScoreIndicatorProps {
  score: number;
  ambiguous: boolean;
  runnerUp: SuggestionRunnerUp<string | number> | null;
  acceptTitle: string;
  onAccept?: () => void;
}

export function SuggestionScoreIndicator({
  score,
  ambiguous,
  runnerUp,
  acceptTitle,
  onAccept,
}: SuggestionScoreIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {onAccept ? (
        <button
          type="button"
          className="cursor-pointer"
          onClick={onAccept}
          title={acceptTitle}
        >
          <ScoreBadge score={score} />
        </button>
      ) : (
        <ScoreBadge score={score} />
      )}

      {ambiguous && runnerUp ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded-sm text-warning-foreground outline-none transition-colors hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Show alternative match"
              >
                <AlertTriangle className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm items-start">
              <span>
                Close runner-up: "{runnerUp.name}" ({runnerUp.score}%).
                Review this row before syncing.
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
