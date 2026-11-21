import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/src/lib/utils';

export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[#E2E8F0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#0D9488] dark:bg-[#334155] dark:focus-visible:ring-[#14B8A6] dark:focus-visible:ring-offset-[#0B1220] dark:data-[state=checked]:bg-[#14B8A6]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-xs transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
