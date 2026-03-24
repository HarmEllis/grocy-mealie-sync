import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold',
        score >= 70 && 'bg-success/15 text-success',
        score >= 40 && score < 70 && 'bg-warning/15 text-warning-foreground',
        score < 40 && 'bg-destructive/15 text-destructive',
        className,
      )}
    >
      {score}%
    </span>
  );
}
