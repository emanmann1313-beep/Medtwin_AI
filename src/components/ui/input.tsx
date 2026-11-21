import * as React from 'react';
import { cn } from '@/src/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#172554] placeholder:text-[#64748B]/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:border-[#0D9488] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]/75 dark:focus-visible:ring-[#14B8A6] dark:focus-visible:border-[#14B8A6]',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[88px] w-full rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#172554] placeholder:text-[#64748B]/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:border-[#0D9488] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]/75 dark:focus-visible:ring-[#14B8A6] dark:focus-visible:border-[#14B8A6]',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
