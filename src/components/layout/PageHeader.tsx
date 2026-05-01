import type { ReactNode } from 'react';

const TITLE_CLASS = 'text-2xl font-extrabold tracking-tight text-text-1';
const SUBTITLE_CLASS = 'mt-1 text-sm text-text-2';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  return (
    <div className={className}>
      <h1 className={TITLE_CLASS}>{title}</h1>
      {subtitle ? <p className={SUBTITLE_CLASS}>{subtitle}</p> : null}
    </div>
  );
}
