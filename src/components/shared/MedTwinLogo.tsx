import React from 'react';
import { cn } from '@/src/lib/utils';

export function MedTwinLogo({
  className,
  showWordmark = true,
  size = 26,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Minimalist interlocking twin rings symbolizing patient & care-team digital twin */}
        <circle
          cx="11"
          cy="14"
          r="7.25"
          className="stroke-[#172554] dark:stroke-[#F8FAFC]"
          strokeWidth="1.75"
        />
        <circle
          cx="17"
          cy="14"
          r="7.25"
          className="stroke-[#0D9488] dark:stroke-[#14B8A6]"
          strokeWidth="1.75"
        />
        <circle
          cx="14"
          cy="14"
          r="1.75"
          className="fill-[#0D9488] dark:fill-[#14B8A6]"
        />
      </svg>
      {showWordmark && (
        <span className="font-display text-[17px] font-semibold tracking-tight text-[#172554] dark:text-[#F8FAFC]">
          MedTwin AI
        </span>
      )}
    </span>
  );
}
