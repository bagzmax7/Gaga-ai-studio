/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Sparkles, Download, RefreshCw, Trash2, CheckCircle2,
  Loader2, FolderPlus, Folder, ChevronDown, Check,
  Archive, Edit2, Maximize2, Clock, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import {
  RetouchProject, RetouchItem, RetouchModelId, RETOUCH_MODELS, RetouchVersion
} from '@/lib/retouch/types';
import BeforeAfterSlider from '@/components/retouch/BeforeAfterSlider';
import RegenerateModal from '@/components/retouch/RegenerateModal';
import ProjectCreateModal from '@/components/retouch/ProjectCreateModal';
import FullPreviewModal from '@/components/retouch/FullPreviewModal';
import { downloadAsset } from '@/lib/download';
import JSZip from 'jszip';

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  status: 'idle' | 'uploading' | 'ready';
  error?: string;
}

function formatProjectDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatRetouchedFileName(originalName: string, versionNumber: number): string {
  if (!originalName) return `Image-Retouched-v${versionNumber}.png`;
  const base = originalName.replace(/\.[^/.]+$/, '');
  const cleanBase = base.replace(/-Retouched(-v\d+)?$/i, '').replace(/_Retouched(_v\d+)?$/i, '');
  return `${cleanBase}-Retouched-v${versionNumber}.png`;
}

export function getModelDisplayName(modelId?: string): string {
  if (modelId === 'flux-2-edit') return 'Gaga Klein';
  if (modelId === 'gpt-2.5-sunburst') return 'Sunburst 2.5 (New)';
  return 'Gaga Pro';
}

export default function AutoRetouchLauncher() {
  const { addTask } = useTasks();

  // Projects State
  const [projects, setProjects] = useState<RetouchProject[]>([]);
  const [activeProject, setActiveProject] = useState<RetouchProject | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  // Rename Project State
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Staged Files for Upload
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Model selection
  const [selectedModel, setSelectedModel] = useState<RetouchModelId>('flux-2-edit');

  // Regenerate Modal State
  const [regeneratingItem, setRegeneratingItem] = useState<RetouchItem | null>(null);

  // Fullscreen Preview Modal State
  const [fullPreviewItem, setFullPreviewItem] = useState<{
    item: RetouchItem;
    activeVersion: RetouchVersion;
  } | null>(null);

  // ZIP Download State
  const [isZipping, setIsZipping] = useState(false);

  // 1. Fetch User Projects
  const loadProjects = useCallback(async (selectProjectId?: string) => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/retouch/projects');
      if (res.ok) {
        const data = await res.json();
        const list: RetouchProject[] = data.projects || [];
        setProjects(list);

        if (list.length > 0) {
          const target = selectProjectId
            ? list.find((p) => p.id === selectProjectId)
            : list[0];
          const selected = target || list[0];
          setActiveProject(selected);
          if (selected?.defaultModel) setSelectedModel(selected.defaultModel);
        } else {
          // Auto-create default first project if none exists
          const createRes = await fetch('/api/retouch/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Catalog Photoshoot',
              description: 'Default studio retouch workspace',
              defaultModel: 'flux-2-edit',
            }),
          });
          if (createRes.ok) {
            const createdData = await createRes.json();
            setProjects([createdData.project]);
            setActiveProject(createdData.project);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load retouch projects:', err);
      toast.error('Failed to load retouch projects');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 2. Poll In-Flight Retouch Tasks
  useEffect(() => {
    if (!activeProject) return;

    const hasPending = activeProject.items.some((item) =>
      item.versions.some((v) => v.status === 'RUNNING' || v.status === 'QUEUED')
    );
    if (!hasPending) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/retouch/sessions?projectId=${activeProject.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            setActiveProject(data.project);
            setProjects((prev) =>
              prev.map((p) => (p.id === data.project.id ? data.project : p))
            );
          }
        }
      } catch (err) {
        console.error('Poll session error:', err);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [activeProject]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith('image/'));
    if (!valid.length) {
      toast.error('Please upload image files (PNG, JPG, WebP)');
      return;
    }
    const newStaged: StagedFile[] = valid.map((file) => ({
      id: `staged_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
    }));

    // Pre-measure dimensions
    newStaged.forEach((staged) => {
      const img = new Image();
      img.onload = () => {
        setStagedFiles((prev) =>
          prev.map((item) =>
            item.id === staged.id
              ? { ...item, width: img.naturalWidth, height: img.naturalHeight }
              : item
          )
        );
      };
      img.src = staged.previewUrl;
    });

    setStagedFiles((prev) => [...prev, ...newStaged].slice(0, 20));
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // 3. Trigger Batch Retouching
  const runBatchRetouch = async () => {
    if (!activeProject) {
      toast.error('Please select or create a project first');
      return;
    }
    const idleFiles = stagedFiles.filter((f) => f.status === 'idle');
    if (!idleFiles.length) {
      toast.error('No new images to retouch');
      return;
    }

    setIsBatchRunning(true);
    const toastId = toast.loading(`Uploading & retouching ${idleFiles.length} images...`);

    try {
      for (const staged of idleFiles) {
        setStagedFiles((prev) =>
          prev.map((f) => (f.id === staged.id ? { ...f, status: 'uploading' } : f))
        );

        // Step A: Upload to Media endpoint
        const formData = new FormData();
        formData.append('file', staged.file);

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('Image upload failed');
        const uploadData = await uploadRes.json();
        const uploadedUrl = uploadData.fileUrl;
        if (!uploadedUrl) throw new Error('No uploaded file URL returned');

        // Step B: Trigger Retouch Generate
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const cleanItemName = staged.file.name.replace(/\.[^/.]+$/, '');
        const genRes = await fetch('/api/retouch/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: activeProject.id,
            itemId,
            itemName: cleanItemName,
            originalUrl: uploadedUrl,
            width: staged.width,
            height: staged.height,
            model: selectedModel,
          }),
        });

        if (!genRes.ok) {
          const genErr = await genRes.json();
          throw new Error(genErr.error || 'Retouch task generation failed');
        }

        const genData = await genRes.json();

        if (genData.taskId) {
          addTask(
            genData.taskId,
            'auto-retouch',
            `Auto Retouch: ${staged.file.name}`,
            [
              { nodeId: 'INPUT', fieldName: 'image', fieldValue: uploadedUrl },
              { nodeId: 'CONFIG', fieldName: 'model', fieldValue: selectedModel },
            ]
          );
        }

        if (genData.project) {
          setActiveProject(genData.project);
        }
      }

      toast.success('Retouch batch started successfully!', { id: toastId });
      setStagedFiles([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch retouching failed';
      toast.error(msg, { id: toastId });
    } finally {
      setIsBatchRunning(false);
    }
  };

  // 4. Regenerate a Single Item
  const handleRegenerate = async (itemId: string, model: RetouchModelId) => {
    if (!activeProject) return;
    const item = activeProject.items.find((i) => i.id === itemId);
    if (!item) return;

    const toastId = toast.loading('Starting regeneration...');
    try {
      const res = await fetch('/api/retouch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          itemId: item.id,
          itemName: item.name,
          originalUrl: item.originalUrl,
          width: item.originalWidth,
          height: item.originalHeight,
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Regeneration failed');
      }

      const data = await res.json();
      if (data.project) {
        setActiveProject(data.project);
      }
      toast.success(`Regeneration queued (v${data.versionNumber})!`, { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      toast.error(msg, { id: toastId });
    }
  };

  // 5. Download All Finished Images as ZIP
  const downloadBatchZip = async () => {
    if (!activeProject || !activeProject.items.length) return;
    const completedItems = activeProject.items.filter((item) => {
      const v = item.versions[item.activeVersionIndex];
      return v && v.status === 'SUCCESS' && v.outputUrl;
    });

    if (!completedItems.length) {
      toast.error('No finished retouched images to download');
      return;
    }

    setIsZipping(true);
    const toastId = toast.loading(`Packaging ${completedItems.length} images into ZIP...`);

    try {
      const zip = new JSZip();
      for (const item of completedItems) {
        const v = item.versions[item.activeVersionIndex];
        const res = await fetch(v.outputUrl);
        const blob = await res.blob();
        const filename = formatRetouchedFileName(item.name, v.versionNumber);
        zip.file(filename, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${activeProject.name || 'Retouched-Batch'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('ZIP download ready!', { id: toastId });
    } catch (err) {
      console.error('ZIP failed:', err);
      toast.error('Failed to create ZIP', { id: toastId });
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Project Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#12141c] border border-white/10 shadow-lg">
        {/* Project Selector */}
        <div className="relative">
          <button
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#181a25] border border-white/10 hover:border-lime-500/40 text-left transition-all"
          >
            <Folder className="w-4 h-4 text-lime-400" />
            <div className="min-w-[140px]">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                {activeProject ? activeProject.name : 'Select Project'}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-[10px] text-gray-400">
                {activeProject ? `${activeProject.items.length} items` : 'No active workspace'}
              </div>
            </div>
          </button>

          {/* Project Dropdown */}
          {isProjectDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-[#181a25] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Workspaces ({projects.length})
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p);
                      setIsProjectDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition-all',
                      activeProject?.id === p.id
                        ? 'bg-lime-500/10 text-lime-400 font-bold border border-lime-500/20'
                        : 'text-gray-300 hover:bg-white/5'
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    {activeProject?.id === p.id && <Check className="w-3.5 h-3.5 text-lime-400" />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  setIsCreateProjectOpen(true);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-lime-400 bg-lime-500/10 hover:bg-lime-500/20 transition-all border border-lime-500/20"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Workspace
              </button>
            </div>
          )}
        </div>

        {/* Model Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#181a25] border border-white/10 rounded-xl p-1">
            {RETOUCH_MODELS.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                    isSelected
                      ? 'bg-lime-500 text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  {m.name}
                </button>
              );
            })}
          </div>

          {activeProject && activeProject.items.length > 0 && (
            <button
              onClick={downloadBatchZip}
              disabled={isZipping}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#181a25] hover:bg-[#202332] text-xs font-bold text-white border border-white/10 transition-colors disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5 text-lime-400" />
              Download All (ZIP)
            </button>
          )}
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3',
          isDragging
            ? 'border-lime-500 bg-lime-500/10'
            : 'border-white/15 bg-[#10121a]/50 hover:border-lime-500/40 hover:bg-[#10121a]'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="w-12 h-12 rounded-2xl bg-lime-500/10 border border-lime-500/25 flex items-center justify-center text-lime-400">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">
            Upload Product Photos for AI Retouching
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Drag & drop up to 20 images or click to browse (PNG, JPG, WebP)
          </p>
        </div>
      </div>

      {/* Staged Uploads Queue Preview */}
      {stagedFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#12141c] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              Ready for Retouch ({stagedFiles.length})
            </span>
            <button
              onClick={runBatchRetouch}
              disabled={isBatchRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold transition-all disabled:opacity-50 shadow-lg"
            >
              {isBatchRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing Batch...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Start Batch Retouch
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {stagedFiles.map((sf) => (
              <div
                key={sf.id}
                className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 group aspect-square"
              >
                <img
                  src={sf.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStagedFile(sf.id);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery Cards of Finished / Processing Retouch Items */}
      {activeProject && activeProject.items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-lime-400" />
              Retouched Gallery ({activeProject.items.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeProject.items.map((item) => {
              const activeVersion = item.versions[item.activeVersionIndex] || item.versions[0];
              const isProcessing =
                item.status === 'processing' ||
                activeVersion?.status === 'RUNNING' ||
                activeVersion?.status === 'QUEUED';

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-[#12141c] border border-white/10 space-y-3 shadow-xl"
                >
                  {/* Before/After Slider */}
                  <BeforeAfterSlider
                    beforeUrl={item.originalUrl}
                    afterUrl={activeVersion?.outputUrl || null}
                    versionLabel={activeVersion ? `v${activeVersion.versionNumber}` : 'v1'}
                    aspectRatio="1/1"
                    isProcessing={isProcessing}
                    onOpenFullView={() => {
                      if (activeVersion) {
                        setFullPreviewItem({ item, activeVersion });
                      }
                    }}
                  />

                  {/* Item Details & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {activeVersion ? activeVersion.modelName : 'Processing...'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Version badges / switch */}
                      {item.versions.length > 1 && (
                        <div className="flex items-center gap-1 bg-[#181a25] p-1 rounded-lg border border-white/5">
                          {item.versions.map((v, vIdx) => (
                            <button
                              key={v.versionNumber}
                              onClick={() => {
                                const updated = {
                                  ...activeProject,
                                  items: activeProject.items.map((it) =>
                                    it.id === item.id ? { ...it, activeVersionIndex: vIdx } : it
                                  ),
                                };
                                setActiveProject(updated);
                              }}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[9px] font-black',
                                item.activeVersionIndex === vIdx
                                  ? 'bg-lime-500 text-black'
                                  : 'text-gray-400 hover:text-white'
                              )}
                            >
                              v{v.versionNumber}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Regenerate Button */}
                      <button
                        onClick={() => setRegeneratingItem(item)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        title="Regenerate with another engine"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {/* Download Button */}
                      {activeVersion?.outputUrl && (
                        <button
                          onClick={() => {
                            downloadAsset(
                              activeVersion.outputUrl,
                              formatRetouchedFileName(item.name, activeVersion.versionNumber)
                            );
                          }}
                          className="p-1.5 rounded-lg bg-lime-500/20 hover:bg-lime-500 text-lime-400 hover:text-black transition-colors"
                          title="Download Image"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <ProjectCreateModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={async (name, desc, model) => {
          const res = await fetch('/api/retouch/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc, defaultModel: model }),
          });
          if (res.ok) {
            const data = await res.json();
            setProjects((prev) => [data.project, ...prev]);
            setActiveProject(data.project);
            toast.success('Workspace created!');
          }
        }}
      />

      <RegenerateModal
        item={regeneratingItem}
        isOpen={!!regeneratingItem}
        onClose={() => setRegeneratingItem(null)}
        onRegenerate={handleRegenerate}
      />

      {fullPreviewItem && (
        <FullPreviewModal
          isOpen={!!fullPreviewItem}
          onClose={() => setFullPreviewItem(null)}
          itemName={fullPreviewItem.item.name}
          originalUrl={fullPreviewItem.item.originalUrl}
          outputUrl={fullPreviewItem.activeVersion.outputUrl || null}
          versionNumber={fullPreviewItem.activeVersion.versionNumber}
          modelName={fullPreviewItem.activeVersion.modelName}
        />
      )}
    </div>
  );
}
