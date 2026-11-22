import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/src/lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#E6E0D8] bg-[#FAF8F5] p-1 text-[#5C627D] dark:border-[#2B314D] dark:bg-[#101322] dark:text-[#A3A9C2] dashboard-dark:border-[#334155] dashboard-dark:bg-[#101B30] dashboard-dark:text-[#A8B8CC]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7956C8] data-[state=active]:bg-[#FFFFFF] data-[state=active]:text-[#20243A] data-[state=active]:shadow-xs cursor-pointer dark:focus-visible:ring-[#A58AE8] dark:data-[state=active]:bg-[#171B2E] dark:data-[state=active]:text-[#F7F5F0] dashboard-dark:focus-visible:ring-[#8B5CF6] dashboard-dark:hover:text-[#F8FAFC] dashboard-dark:data-[state=active]:bg-[#223451] dashboard-dark:data-[state=active]:text-[#F8FAFC] dashboard-dark:data-[state=active]:shadow-[0_0_12px_rgba(139,92,246,0.2)]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...props}
    />
  );
}
