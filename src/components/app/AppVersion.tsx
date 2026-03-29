import { appVersion } from '@/lib/app-info';
import { cn } from '@/lib/utils';

interface AppVersionProps {
  className?: string;
}

export function AppVersion({ className }: AppVersionProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-border/80 bg-muted/70 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground',
        className,
      )}
    >
      v{appVersion}
    </span>
  );
}
