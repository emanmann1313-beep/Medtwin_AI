import React, { useId } from 'react';
import { cn } from '@/src/lib/utils';

export interface ProgressRingProps {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
  tone?: 'teal' | 'violet' | 'amber' | 'navy';
  className?: string;
}

export function ProgressRing({
  value,
  size = 128,
  strokeWidth = 10,
  label,
  sublabel,
  tone = 'teal',
  className,
}: ProgressRingProps) {
  const gradId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  const palette = {
    teal: { start: '#24A99B', end: '#2EC4B6', text: 'text-[#24A99B] dark:text-[#2EC4B6]' },
    violet: { start: '#7956C8', end: '#9D7CE8', text: 'text-[#7956C8] dark:text-[#9D7CE8]' },
    amber: { start: '#D97706', end: '#F59E0B', text: 'text-amber-600 dark:text-amber-400' },
    navy: { start: '#20243A', end: '#7956C8', text: 'text-[#20243A] dark:text-[#FAF8F5]' },
  }[tone];

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.start} />
              <stop offset="100%" stopColor={palette.end} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-[#E5DFEC] dark:stroke-[#2A304A]"
          />
          {value !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke={`url(#${gradId})`}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span className={cn('font-display text-2xl font-bold tabular-nums leading-none', palette.text)}>
            {value !== null ? `${clamped}%` : '—'}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#20243A] dark:text-[#FAF8F5]">{label}</p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-[#5A607A] dark:text-[#A4A9C2] tabular-nums">{sublabel}</p>
      )}
    </div>
  );
}
