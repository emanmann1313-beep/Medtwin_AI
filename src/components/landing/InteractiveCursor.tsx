import React, { useEffect, useRef, useState } from 'react';

/**
 * Lightweight, GPU-composited cursor ring & ambient glow for desktop fine pointers.
 * Respects prefers-reduced-motion and hides automatically on touch devices.
 */
export function InteractiveCursor() {
  const [enabled, setEnabled] = useState(false);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFinePointer || prefersReducedMotion) {
      setEnabled(false);
      return;
    }

    setEnabled(true);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let glowX = targetX;
    let glowY = targetY;
    let visible = false;
    let isInteractive = false;
    let isPressed = false;
    let rafId = 0;

    const updateTransforms = () => {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      glowX += (targetX - glowX) * 0.08;
      glowY += (targetY - glowY) * 0.08;

      if (ringRef.current) {
        const scale = isPressed ? 0.85 : isInteractive ? 1.55 : 1;
        ringRef.current.style.opacity = visible ? '1' : '0';
        ringRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${scale})`;
        ringRef.current.style.borderColor = isInteractive
          ? 'rgba(20, 184, 166, 0.85)'
          : 'rgba(20, 184, 166, 0.42)';
        ringRef.current.style.backgroundColor = isInteractive
          ? 'rgba(20, 184, 166, 0.09)'
          : 'transparent';
      }

      if (dotRef.current) {
        const dotScale = isPressed ? 1.35 : isInteractive ? 0.5 : 1;
        dotRef.current.style.opacity = visible ? '1' : '0';
        dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(${dotScale})`;
      }

      if (glowRef.current) {
        glowRef.current.style.opacity = visible ? '1' : '0';
        glowRef.current.style.transform = `translate3d(${glowX}px, ${glowY}px, 0) translate(-50%, -50%)`;
      }

      rafId = window.requestAnimationFrame(updateTransforms);
    };

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      visible = true;

      const el = e.target as HTMLElement | null;
      isInteractive = Boolean(
        el?.closest('a, button, input, textarea, select, [data-cursor="interactive"]'),
      );
    };

    const onMouseDown = () => {
      isPressed = true;
    };
    const onMouseUp = () => {
      isPressed = false;
    };
    const onMouseLeave = () => {
      visible = false;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    rafId = window.requestAnimationFrame(updateTransforms);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Subtle ambient cursor-tracking spotlight */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-0 h-[440px] w-[440px] rounded-full opacity-0 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle, rgba(20, 184, 166, 0.11) 0%, rgba(59, 130, 246, 0.04) 42%, transparent 72%)',
        }}
      />
      {/* Trailing precision ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[70] h-8 w-8 rounded-full border transition-[border-color,background-color,opacity] duration-150"
      />
      {/* Center tracking dot */}
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[71] h-1.5 w-1.5 rounded-full bg-[#0D9488] dark:bg-[#14B8A6] transition-opacity duration-150"
      />
    </>
  );
}
