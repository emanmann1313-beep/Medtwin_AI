import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-[#14B8A6] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1220] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-xs dark:bg-[#14B8A6] dark:text-[#0B1220] dark:hover:bg-[#2DD4BF]',
        secondary:
          'bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-xs dark:bg-[#3B82F6] dark:text-white dark:hover:bg-[#2563EB]',
        outline:
          'border border-[#E2E8F0] bg-[#FFFFFF] text-[#172554] hover:bg-[#CCFBF1]/45 dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]',
        ghost:
          'text-[#172554] hover:bg-[#CCFBF1]/50 dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xs dark:bg-red-600 dark:hover:bg-red-500',
        amber: 'bg-[#D97706] text-white hover:bg-[#B45309] shadow-xs',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 py-1.5 text-xs rounded-lg',
        lg: 'h-11 px-5 py-2.5',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
