'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import BeforeAfterSlider from './BeforeAfterSlider';
import { downloadAsset } from '@/lib/download';

interface FullPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  originalUrl: string;
  outputUrl: string | null;
  versionNumber: number;
  modelName: string;
  transparentPattern?: boolean;
  afterBadgeLabel?: string;
}

export default function FullPreviewModal({
  isOpen,
  onClose,
  itemName,
  originalUrl,
  outputUrl,
  versionNumber,
  modelName,
  transparentPattern = false,
  afterBadgeLabel,
}: FullPreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1, Math.round((prev - 0.25) * 100) / 100);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(4, Math.round((prev + 0.15) * 100) / 100));
    } else {
      setZoom((prev) => {
        const next = Math.max(1, Math.round((prev - 0.15) * 100) / 100);
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#07080b]/95 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d0e14]/80 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {itemName}
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-lime-500 text-black font-black">
                v{versionNumber}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Model: {modelName}</p>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-[#171922] border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-gray-300 px-2 min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoom > 1 && (
              <button
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors ml-1 border-l border-white/10 pl-2"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Download button */}
          {outputUrl && (
            <button
              onClick={() => {
                downloadAsset(outputUrl, `${itemName}-v${versionNumber}.png`);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Comparison Area */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-hidden flex items-center justify-center p-4 lg:p-8"
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-5xl max-h-[85vh] flex items-center justify-center">
          <BeforeAfterSlider
            beforeUrl={originalUrl}
            afterUrl={outputUrl}
            versionLabel={`v${versionNumber}`}
            className="w-full max-h-[80vh] shadow-2xl"
            aspectRatio="auto"
            zoom={zoom}
            pan={pan}
            onPanChange={setPan}
            transparentPattern={transparentPattern}
            afterBadgeLabel={afterBadgeLabel}
          />
        </div>
      </div>
    </div>
  );
}
