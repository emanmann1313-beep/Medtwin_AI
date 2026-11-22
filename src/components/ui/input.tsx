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
      'flex h-10 w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#20243A] placeholder:text-[#5C627D]/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7956C8] focus-visible:border-[#7956C8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0] dark:placeholder:text-[#A3A9C2]/70 dark:focus-visible:ring-[#A58AE8] dark:focus-visible:border-[#A58AE8]',
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
      'flex min-h-[88px] w-full rounded-xl border border-[#E6E0D8] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#20243A] placeholder:text-[#5C627D]/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7956C8] focus-visible:border-[#7956C8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#F7F5F0] dark:placeholder:text-[#A3A9C2]/70 dark:focus-visible:ring-[#A58AE8] dark:focus-visible:border-[#A58AE8]',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
