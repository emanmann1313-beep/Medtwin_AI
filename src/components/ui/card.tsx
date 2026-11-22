import * as React from 'react';
import { cn } from '@/src/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] shadow-[0_4px_24px_rgba(32,36,58,0.04)] transition-colors duration-200 dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0] dark:shadow-[0_10px_30px_rgba(0,0,0,0.28)] dashboard-dark:border-[#334155] dashboard-dark:bg-[#1A2740] dashboard-dark:text-[#F8FAFC] dashboard-dark:shadow-[0_14px_34px_rgba(2,6,23,0.48)]',
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
        'font-display text-base font-semibold tracking-tight text-[#20243A] dark:text-[#F7F5F0] dashboard-dark:text-[#F8FAFC]',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-sm text-[#5C627D] dark:text-[#A3A9C2] dashboard-dark:text-[#A8B8CC]',
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />;
}
