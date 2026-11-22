import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#101322]/60 backdrop-blur-[2px] dashboard-dark:bg-[#0B1220]/75 dashboard-dark:backdrop-blur-sm" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E6E0D8] bg-[#FFFFFF] p-6 text-[#20243A] shadow-xl focus:outline-none max-h-[88vh] overflow-y-auto dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0] dashboard-dark:border-[#334155] dashboard-dark:bg-[#1A2740] dashboard-dark:text-[#F8FAFC] dashboard-dark:shadow-[0_24px_64px_rgba(2,6,23,0.72)]',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Close modal"
        className="absolute right-4 top-4 rounded-lg p-1.5 text-[#5C627D] hover:bg-[#D8C5E8]/40 hover:text-[#20243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7956C8] dark:text-[#A3A9C2] dark:hover:bg-[#2B314D] dark:hover:text-[#F7F5F0] dark:focus-visible:ring-[#A58AE8] dashboard-dark:text-[#A8B8CC] dashboard-dark:hover:bg-[#223451] dashboard-dark:hover:text-[#F8FAFC] dashboard-dark:focus-visible:ring-[#8B5CF6]"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1 pr-6', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'font-display text-lg font-semibold text-[#20243A] dark:text-[#F7F5F0] dashboard-dark:text-[#F8FAFC]',
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn(
        'text-sm text-[#5C627D] dark:text-[#A3A9C2] dashboard-dark:text-[#A8B8CC]',
        className,
      )}
      {...props}
    />
  );
}
