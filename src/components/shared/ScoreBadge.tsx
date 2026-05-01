import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap',
        score >= 70 && 'bg-success/15 text-success border-[color:color-mix(in_oklab,var(--success)_35%,transparent)]',
        score >= 40 && score < 70 && 'bg-warning/15 text-warning border-[color:color-mix(in_oklab,var(--warning)_35%,transparent)]',
        score < 40 && 'bg-destructive/15 text-destructive border-[color:color-mix(in_oklab,var(--destructive)_35%,transparent)]',
        className,
      )}
    >
      {score}%
    </span>
  );
}
