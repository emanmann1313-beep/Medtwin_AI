import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7956C8] dark:focus-visible:ring-[#A58AE8] dashboard-dark:focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#101322] dashboard-dark:focus-visible:ring-offset-[#0B1220] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#24A99B] text-white hover:bg-[#1E9286] shadow-xs dark:bg-[#2DD4BF] dark:text-[#101322] dark:hover:bg-[#5EEAD4] dashboard-dark:bg-[#8B5CF6] dashboard-dark:text-[#F8FAFC] dashboard-dark:hover:bg-[#7C3AED] dashboard-dark:shadow-[0_0_20px_rgba(139,92,246,0.32)]',
        secondary:
          'bg-[#7956C8] text-white hover:bg-[#6645B5] shadow-xs dark:bg-[#9D7CE8] dark:text-[#101322] dark:hover:bg-[#B295F0] dashboard-dark:bg-[#2DD4BF] dashboard-dark:text-[#0B1220] dashboard-dark:hover:bg-[#5EEAD4] dashboard-dark:shadow-[0_0_16px_rgba(45,212,191,0.24)]',
        outline:
          'border border-[#E6E0D8] bg-[#FFFFFF] text-[#20243A] hover:bg-[#FAF8F5] hover:border-[#7956C8]/40 dark:border-[#2B314D] dark:bg-[#171B2E] dark:text-[#F7F5F0] dark:hover:bg-[#1F253D] dashboard-dark:border-[#334155] dashboard-dark:bg-[#223451] dashboard-dark:text-[#F8FAFC] dashboard-dark:hover:bg-[#2A4064] dashboard-dark:hover:border-[#8B5CF6]/55',
        ghost:
          'text-[#20243A] hover:bg-[#D8C5E8]/35 dark:text-[#F7F5F0] dark:hover:bg-[#1F253D] dashboard-dark:text-[#F8FAFC] dashboard-dark:hover:bg-[#223451]',
        danger:
          'bg-red-600 text-white hover:bg-red-700 shadow-xs dark:bg-red-600 dark:hover:bg-red-500 dashboard-dark:bg-[#FB7185] dashboard-dark:text-[#0B1220] dashboard-dark:font-semibold dashboard-dark:hover:bg-[#FDA4AF]',
        amber:
          'bg-[#D97706] text-white hover:bg-[#B45309] shadow-xs dashboard-dark:bg-[#FBBF24] dashboard-dark:text-[#0B1220] dashboard-dark:font-semibold dashboard-dark:hover:bg-[#FCD34D]',
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
