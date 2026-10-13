'use client';

import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { RetouchModelId, RETOUCH_MODELS } from '@/lib/retouch/types';
import { cn } from '@/lib/utils';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, defaultModel?: RetouchModelId) => Promise<void>;
  title?: string;
  subtitle?: string;
  hideModelSelect?: boolean;
}

export default function ProjectCreateModal({
  isOpen,
  onClose,
  onCreate,
  title = 'Create Retouch Project',
  subtitle = 'Organize batch photoshoot assets',
  hideModelSelect = false,
}: ProjectCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultModel, setDefaultModel] = useState<RetouchModelId>('flux-2-edit');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined, defaultModel);
      setName('');
      setDescription('');
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
              <FolderPlus className="w-4 h-4 text-lime-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-gray-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Project Name <span className="text-lime-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Campaign 2026"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#13151e] border border-[#262a3b] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lime-500 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Description <span className="text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, collection tags, or photoshoot specs..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#13151e] border border-[#262a3b] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-500 transition-colors resize-none"
            />
          </div>

          {!hideModelSelect && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Default Engine
              </label>
              <div className="grid grid-cols-1 gap-2">
                {RETOUCH_MODELS.map((m) => {
                  const isSelected = defaultModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDefaultModel(m.id)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'border-lime-500 bg-lime-500/10 text-white'
                          : 'border-[#262a3b] bg-[#13151e] text-gray-300 hover:border-gray-600'
                      )}
                    >
                      <div className="text-xs font-medium">{m.name}</div>
                      {m.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-lime-500/20 text-lime-400">
                          {m.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#262a3b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-lime-500 hover:bg-lime-400 text-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
