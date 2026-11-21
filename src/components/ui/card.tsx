import * as React from 'react';
import { cn } from '@/src/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] shadow-[0_4px_20px_rgba(23,37,84,0.04)] transition-colors duration-200 dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:shadow-[0_8px_28px_rgba(0,0,0,0.28)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-6 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-display text-base font-semibold tracking-tight text-[#172554] dark:text-[#F8FAFC]',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[#64748B] dark:text-[#94A3B8]', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />;
}
