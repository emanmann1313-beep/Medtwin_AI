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
        {/* Interlocking twin rings symbolizing patient & care-team digital twin */}
        <circle
          cx="11"
          cy="14"
          r="7.25"
          className="stroke-[#7956C8] dark:stroke-[#A58AE8]"
          strokeWidth="1.85"
        />
        <circle
          cx="17"
          cy="14"
          r="7.25"
          className="stroke-[#24A99B] dark:stroke-[#2DD4BF]"
          strokeWidth="1.85"
        />
        <circle
          cx="14"
          cy="14"
          r="1.9"
          className="fill-[#20243A] dark:fill-[#F7F5F0]"
        />
      </svg>
      {showWordmark && (
        <span className="font-display text-[17px] font-semibold tracking-tight text-[#20243A] dark:text-[#F7F5F0]">
          MedTwin AI
        </span>
      )}
    </span>
  );
}
