'use client';

import React, { useState } from 'react';
import { X, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { RetouchItem, RetouchModelId, RETOUCH_MODELS } from '@/lib/retouch/types';
import { cn } from '@/lib/utils';

interface RegenerateModalProps {
  item: RetouchItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (itemId: string, selectedModel: RetouchModelId) => Promise<void>;
}

export default function RegenerateModal({
  item,
  isOpen,
  onClose,
  onRegenerate,
}: RegenerateModalProps) {
  const [selectedModel, setSelectedModel] = useState<RetouchModelId>('flux-2-edit');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !item) return null;

  const nextVersionNum = item.versions.length + 1;

  const handleStart = async () => {
    setLoading(true);
    try {
      await onRegenerate(item.id, selectedModel);
      onClose();
    } catch {
      // Handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0d0e12] border border-[#262a3b] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262a3b] bg-[#14161f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lime-500/10 border border-lime-500/25 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-lime-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Regenerate Retouch
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500 text-black font-black">
                  v{nextVersionNum}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[240px]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Select Retouch Engine
            </label>
            <div className="grid grid-cols-1 gap-2">
              {RETOUCH_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-lime-500 bg-lime-500/10 text-white'
                        : 'border-[#262a3b] bg-[#13151e] text-gray-300 hover:border-gray-600'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className={cn('w-4 h-4', isSelected ? 'text-lime-400' : 'text-gray-400')} />
                      <div>
                        <div className="text-xs font-bold">{m.name}</div>
                        <div className="text-[10px] text-gray-400">
                          {m.id === 'flux-2-edit' && 'Pixel-perfect e-commerce studio white background'}
                          {m.id === 'nano-banana-2' && 'High dynamic range & subtle shadows (Gemini)'}
                          {m.id === 'gpt-2.5-sunburst' && 'Photorealistic ultra 2K studio lighting'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-[#141620] border border-white/5 p-3 text-[11px] text-gray-400 space-y-1">
            <p className="font-semibold text-gray-300">Preservation Notice:</p>
            <p>The original image will be re-used directly without duplicate upload.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#262a3b] bg-[#14161f]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-lime-500 hover:bg-lime-400 text-black transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Version v{nextVersionNum}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
