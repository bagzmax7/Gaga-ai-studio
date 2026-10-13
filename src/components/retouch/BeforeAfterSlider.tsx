/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string | null;
  versionLabel?: string;
  className?: string;
  aspectRatio?: string;
  isProcessing?: boolean;
  onOpenFullView?: () => void;
  // Zoom & Pan props
  zoom?: number;
  pan?: { x: number; y: number };
  isPanning?: boolean;
  onPanChange?: (newPan: { x: number; y: number }) => void;
  // Transparent pattern (for background removal)
  transparentPattern?: boolean;
  afterBadgeLabel?: string;
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  versionLabel = 'v1',
  className,
  aspectRatio = '1/1',
  isProcessing = false,
  onOpenFullView,
  zoom = 1,
  pan = { x: 0, y: 0 },
  onPanChange,
  transparentPattern = false,
  afterBadgeLabel,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 - 100)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isInternalPanning, setIsInternalPanning] = useState(false);
  const [localPan, setLocalPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number }>({
    startX: 0,
    startY: 0,
    initPanX: 0,
    initPanY: 0,
  });

  const currentPan = onPanChange ? pan : localPan;
  const setPan = useCallback((newPan: { x: number; y: number }) => {
    if (onPanChange) {
      onPanChange(newPan);
    } else {
      setLocalPan(newPan);
    }
  }, [onPanChange]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pos);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDraggingSlider) {
      handleSliderMove(e.touches[0].clientX);
    } else if (isInternalPanning && zoom > 1) {
      const rect = containerRef.current?.getBoundingClientRect();
      const width = rect?.width || 800;
      const height = rect?.height || 600;
      const maxPanX = Math.max(0, (width * (zoom - 1)) / 2);
      const maxPanY = Math.max(0, (height * (zoom - 1)) / 2);

      const dx = e.touches[0].clientX - panStartRef.current.startX;
      const dy = e.touches[0].clientY - panStartRef.current.startY;
      const nextX = Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.initPanX + dx));
      const nextY = Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.initPanY + dy));
      setPan({ x: nextX, y: nextY });
    }
  }, [isDraggingSlider, isInternalPanning, zoom, handleSliderMove, setPan]);

  const handleTouchEnd = useCallback(() => {
    setIsDraggingSlider(false);
    setIsInternalPanning(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingSlider) {
      handleSliderMove(e.clientX);
    } else if (isInternalPanning && zoom > 1) {
      const rect = containerRef.current?.getBoundingClientRect();
      const width = rect?.width || 800;
      const height = rect?.height || 600;
      const maxPanX = Math.max(0, (width * (zoom - 1)) / 2);
      const maxPanY = Math.max(0, (height * (zoom - 1)) / 2);

      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      const nextX = Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.initPanX + dx));
      const nextY = Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.initPanY + dy));
      setPan({ x: nextX, y: nextY });
    }
  }, [isDraggingSlider, isInternalPanning, zoom, handleSliderMove, setPan]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingSlider(false);
    setIsInternalPanning(false);
  }, []);

  useEffect(() => {
    if (isDraggingSlider || isInternalPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingSlider, isInternalPanning, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Handle Drag Start
  const startDragSlider = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingSlider(true);
  };

  const startPan = (e: React.MouseEvent | React.TouchEvent) => {
    if (zoom <= 1) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    panStartRef.current = {
      startX: clientX,
      startY: clientY,
      initPanX: currentPan.x,
      initPanY: currentPan.y,
    };
    setIsInternalPanning(true);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative select-none overflow-hidden rounded-xl border border-[#232734] bg-[#0c0d12] shadow-xl group',
        zoom > 1 ? (isInternalPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default',
        className
      )}
      style={{ aspectRatio }}
      onMouseDown={startPan}
      onTouchStart={startPan}
    >
      {/* Background layer: Transparent checkerboard if requested */}
      {transparentPattern && (
        <div
          className="absolute inset-0 pointer-events-none opacity-40 z-0"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #1b1e28 25%, transparent 25%),
              linear-gradient(-45deg, #1b1e28 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #1b1e28 75%),
              linear-gradient(-45deg, transparent 75%, #1b1e28 75%)
            `,
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}
        />
      )}

      {/* Layer 1: AFTER image (base full canvas) */}
      <div
        className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
        style={{
          transform: `scale(${zoom}) translate(${currentPan.x / zoom}px, ${currentPan.y / zoom}px)`,
          transformOrigin: 'center center',
          transition: isInternalPanning ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        {afterUrl ? (
          <img
            src={afterUrl}
            alt="After"
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center text-gray-500">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="w-6 h-6 text-lime-400 animate-spin" />
                <span className="text-xs text-lime-400 font-medium">Processing...</span>
              </div>
            ) : (
              <span className="text-xs">Original only</span>
            )}
          </div>
        )}
      </div>

      {/* Layer 2: BEFORE image (clipped to sliderPosition) */}
      <div
        className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden"
        style={{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          transform: `scale(${zoom}) translate(${currentPan.x / zoom}px, ${currentPan.y / zoom}px)`,
          transformOrigin: 'center center',
          transition: isInternalPanning ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <img
          src={beforeUrl}
          alt="Before"
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Floating Badges */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/75 text-gray-300 backdrop-blur-md border border-white/10 shadow-sm">
          Before (Original)
        </span>
      </div>

      <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center gap-1.5">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-lime-500 text-black shadow-md">
          {afterBadgeLabel || `After (${versionLabel})`}
        </span>
      </div>

      {/* Fullview Expand Button */}
      {onOpenFullView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenFullView();
          }}
          className="absolute bottom-2.5 right-2.5 z-20 p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          title="Fullscreen Compare"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Slider Line & Handle */}
      {afterUrl && (
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Vertical Divider line */}
          <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />

          {/* Interactive Handle */}
          <div
            className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-xl flex items-center justify-center cursor-ew-resize pointer-events-auto border-2 border-[#161822] hover:scale-110 active:scale-95 transition-transform"
            onMouseDown={startDragSlider}
            onTouchStart={startDragSlider}
          >
            <div className="flex items-center gap-0.5 text-gray-700">
              <span className="text-[10px] font-bold">‹</span>
              <span className="text-[10px] font-bold">›</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
