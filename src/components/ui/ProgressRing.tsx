import React from 'react';
import { cn } from '@/src/lib/utils';

export interface ProgressRingProps {
  value: number | null;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  tone?: 'teal' | 'violet' | 'amber' | 'navy';
  className?: string;
}

const TONE_MAP = {
  teal: {
    stroke: 'stroke-[#24A99B] dark:stroke-[#2DD4BF]',
    text: 'text-[#24A99B] dark:text-[#2DD4BF]',
    track: 'stroke-[#E6E0D8] dark:stroke-[#2B314D]',
  },
  violet: {
    stroke: 'stroke-[#7956C8] dark:stroke-[#A58AE8]',
    text: 'text-[#7956C8] dark:text-[#A58AE8]',
    track: 'stroke-[#D8C5E8]/60 dark:stroke-[#2B314D]',
  },
  amber: {
    stroke: 'stroke-[#D97706] dark:stroke-[#FBBF24]',
    text: 'text-[#D97706] dark:text-[#FBBF24]',
    track: 'stroke-[#E6E0D8] dark:stroke-[#2B314D]',
  },
  navy: {
    stroke: 'stroke-[#20243A] dark:stroke-[#F7F5F0]',
    text: 'text-[#20243A] dark:text-[#F7F5F0]',
    track: 'stroke-[#E6E0D8] dark:stroke-[#2B314D]',
  },
};

export function ProgressRing({
  value,
  label,
  sublabel,
  size = 128,
  strokeWidth = 10,
  tone = 'teal',
  className,
}: ProgressRingProps) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const palette = TONE_MAP[tone];

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${label}: ${value === null ? 'No data yet' : `${clamped}%`}`}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={palette.track}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(palette.stroke, 'transition-[stroke-dashoffset] duration-700 ease-out')}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span
            className={cn(
              'font-display font-bold tabular-nums leading-none',
              size >= 140 ? 'text-2xl' : 'text-xl',
              value === null ? 'text-[#5C627D] dark:text-[#A3A9C2]' : palette.text,
            )}
          >
            {value === null ? '—' : `${clamped}%`}
          </span>
        </div>
      </div>
      <p className="mt-2.5 font-display text-sm font-semibold text-[#20243A] dark:text-[#F7F5F0]">
        {label}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-[#5C627D] dark:text-[#A3A9C2] tabular-nums">
          {sublabel}
        </p>
      )}
    </div>
  );
}
