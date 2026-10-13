/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps, react-hooks/purity, react/no-unescaped-entities, @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import GagaSidebar from '@/components/gaga-sidebar';
import GagaAuthGate from '@/components/gaga-auth-gate';
import { useTasks } from '@/hooks/useTasks';
import {
  Sparkles, Plus, Image as ImageIcon, Film, X, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, Zap, Download,
  Upload, FileAudio, Clock, ArrowRight, ArrowLeft,
  RotateCcw, Maximize2, FolderKanban, FolderPlus,
  Edit3, Trash2, Folder, Check, Play, Pause, ZoomIn, ZoomOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { downloadAsset } from '@/lib/download';

// ─── Model Configs ─────────────────────────────────────────────────────────
const IMAGE_MODELS = [
  { id: 'gpt-2.5-sunburst', name: 'GPT Image 2.5 Sunburst (New)', logo: '/model-logos/GPT.png', stats: ['2K-4K', 'Photoreal Ultra'] },
  { id: 'gpt-2.5-flare', name: 'GPT Image 2.5 Flare (New)', logo: '/model-logos/GPT.png', stats: ['2K-4K', 'Dynamic Flare'] },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'High Quality'] },
  { id: 'nano-banana-2', name: 'Nano Banana 2 (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'Balanced'] },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite (Fast)', logo: '/model-logos/Gemini.png', stats: ['1K Only', 'Fastest'] },
  { id: 'gpt-2.0', name: 'GPT Image 2.0 (Standard)', logo: '/model-logos/GPT.png', stats: ['1K-4K', 'Standard'] },
  { id: 'flux-2-edit', name: 'Flux 2 Edit (Standard)', logo: '/model-logos/Flux.png', stats: ['1K-4K', 'Pro Edit'] },
];

const VIDEO_MODELS = [
  { id: 'seedance-2.0-mini', name: 'Seedance 2.0 Mini (Fast)', logo: '/model-logos/Seedance.png', stats: ['480p-720p', '4s-15s'] },
  { id: 'seedance-2.0-official', name: 'Seedance 2.0 (Recommended)', logo: '/model-logos/Seedance.png', stats: ['480p-720p', '4s-15s'] },
  { id: 'gemini-omni-flash', name: 'Gemini Omni 1.1 Flash (Recommended)', logo: '/model-logos/Gemini.png', stats: ['360p-720p', '3s-10s'] },
  { id: 'veo-3.1-fast', name: 'Veo 3.1 Fast', logo: '/model-logos/Gemini.png', stats: ['720p', '8s'] },
  { id: 'minimax-h3', name: 'MiniMax H3', logo: '/model-logos/MiniMax.png', stats: ['768P', '5s-15s'] },
  { id: 'ltx-2.3', name: 'LTX 2.3', logo: '/model-logos/Ltx.png', stats: ['480p-720p', '5s-15s'] },
];

// ─── Temporary Feature Flags (toggle here to re-enable later) ──────────────
const DISABLED_VIDEO_MODELS: string[] = [];
const ENABLE_VIDEO_BATCH = false;

function resolveImageModelId(rawModel?: string): string {
  if (!rawModel) return 'nano-banana-2';
  const m = rawModel.toLowerCase().trim();
  if (m.includes('sunburst')) return 'gpt-2.5-sunburst';
  if (m.includes('flare')) return 'gpt-2.5-flare';
  if (m.includes('gpt') || m.includes('2046503667076751361')) return 'gpt-2.0';
  if (m.includes('flux') || m.includes('klein') || m.includes('2034877792577191938')) return 'flux-2-edit';
  if (m.includes('lite') || m.includes('fast')) return 'nano-banana-2-lite';
  if (m.includes('pro')) return 'nano-banana-pro';
  if (m.includes('banana') || m.includes('nano')) return 'nano-banana-2';
  const exact = IMAGE_MODELS.find(im => im.id === rawModel);
  if (exact) return exact.id;
  return 'nano-banana-2';
}

function resolveVideoModelId(rawModel?: string): string {
  if (!rawModel) return 'seedance-2.0-mini';
  const m = rawModel.toLowerCase().trim();
  if (m.includes('official')) return 'seedance-2.0-official';
  if (m.includes('seedance') || m.includes('mini')) return 'seedance-2.0-mini';
  if (m.includes('omni') || m.includes('flash')) return 'gemini-omni-flash';
  if (m.includes('veo')) return 'veo-3.1-fast';
  if (m.includes('minimax') || m.includes('h3')) return 'minimax-h3';
  if (m.includes('ltx')) return 'ltx-2.3';
  const exact = VIDEO_MODELS.find(vm => vm.id === rawModel);
  if (exact) return exact.id;
  return 'seedance-2.0-mini';
}

interface VideoModelConfig {
  ratios: string[];
  resolutions: string[];
  defaultResolution: string;
  durationMode: 'slider' | 'tiles';
  durations: string[];
  minDuration?: number;
  maxDuration?: number;
  defaultDuration: string;
  supportsRealPerson: boolean;
  supportsAudio: boolean;
}

const VIDEO_MODEL_CONFIGS: Record<string, VideoModelConfig> = {
  'seedance-2.0-mini': {
    ratios: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['720p', '480p'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: '6s',
    supportsRealPerson: true,
    supportsAudio: true,
  },
  'seedance-2.0-official': {
    ratios: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['720p', '480p'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: '6s',
    supportsRealPerson: true,
    supportsAudio: true,
  },
  'gemini-omni-flash': {
    ratios: ['Auto', '16:9', '9:16'],
    resolutions: ['720p', '360p'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 3,
    maxDuration: 10,
    defaultDuration: '8s',
    supportsRealPerson: false,
    supportsAudio: false,
  },
  'veo-3.1-fast': {
    ratios: ['Auto', '16:9', '9:16'],
    resolutions: ['720p'],
    defaultResolution: '720p',
    durationMode: 'tiles',
    durations: ['8s'],
    defaultDuration: '8s',
    supportsRealPerson: false,
    supportsAudio: true,
  },
  'minimax-h3': {
    ratios: ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['768P'],
    defaultResolution: '768P',
    durationMode: 'slider',
    durations: [],
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: '5s',
    supportsRealPerson: false,
    supportsAudio: true,
  },
  'ltx-2.3': {
    ratios: ['Auto', '16:9', '9:16'],
    resolutions: ['720p', '480p'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: '5s',
    supportsRealPerson: false,
    supportsAudio: false,
  },
};

const NANO_BANANA_RATIOS = ['Auto', '1:1', '2:3', '3:2', '4:5', '5:4', '4:3', '3:4', '16:9', '9:16', '21:9', '1:4', '4:1', '1:8', '8:1'];
const GPT_25_IMAGE_RATIOS = ['Auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'];
const GPT_IMAGE_RATIOS = ['Auto', '1:1', '2:3', '3:2', '4:5', '5:4', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21', '2:1', '1:2', '3:1', '1:3'];
const IMAGE_QUALITIES = ['1k', '2k', '4k'];

// Helper SVG graphic icon for aspect ratio tiles
function AspectRatioGraphic({ ratio, className = "w-4 h-4" }: { ratio: string; className?: string }) {
  if (ratio === 'Auto') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
        <rect x="8" y="8" width="8" height="8" rx="1" />
      </svg>
    );
  }

  let width = 16;
  let height = 16;

  if (ratio === '1:1' || ratio === '960x960') { width = 16; height = 16; }
  else if (ratio === '2:3' || ratio === '3:4' || ratio === '4:5' || ratio === '784x1168') { width = 12; height = 18; }
  else if (ratio === '3:2' || ratio === '4:3' || ratio === '5:4' || ratio === '1168x784') { width = 18; height = 12; }
  else if (ratio === '16:9' || ratio === '1280x720' || ratio === '2:1' || ratio === '3:1') { width = 20; height = 11; }
  else if (ratio === '9:16' || ratio === '720x1280' || ratio === '1:2' || ratio === '1:3') { width = 11; height = 20; }
  else if (ratio === '21:9' || ratio === '4:1' || ratio === '8:1') { width = 22; height = 9; }
  else if (ratio === '1:4' || ratio === '1:8' || ratio === '9:21') { width = 9; height = 22; }

  const x = (24 - width) / 2;
  const y = (24 - height) / 2;

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="2">
      <rect x={x} y={y} width={width} height={height} rx="2" />
    </svg>
  );
}

function parseModelName(fullName: string) {
  const match = fullName.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return {
      displayName: match[1].trim(),
      badge: match[2].trim()
    };
  }
  return {
    displayName: fullName.trim(),
    badge: null
  };
}

function ModelBadge({ text }: { text: string }) {
  let colorClass = 'bg-[#d9b66f] text-[#17140e] font-black italic';
  const cleanText = text.toUpperCase();
  if (cleanText.includes('NEW') || cleanText.includes('EXCLUSIVE')) {
    colorClass = 'bg-[#d9b66f] text-[#17140e] font-black italic shadow-sm';
  } else if (cleanText.includes('RECOMMENDED')) {
    colorClass = 'bg-[#d9b66f] text-[#17140e] font-black italic shadow-sm';
  } else if (cleanText.includes('FAST') || cleanText.includes('LITE') || cleanText.includes('FASTER')) {
    colorClass = 'bg-[#fbbf24] text-[#0d0e10] font-black italic shadow-sm';
  } else if (cleanText.includes('STANDARD') || cleanText.includes('PRO') || cleanText.includes('OFFICIAL')) {
    colorClass = 'bg-[#e2e8f0] text-[#0f172a] font-black shadow-sm';
  } else if (cleanText.includes('COMING SOON')) {
    colorClass = 'bg-blue-400 text-[#0d0e10] font-black italic shadow-sm';
  } else {
    colorClass = 'bg-[#e2e8f0] text-[#0f172a] font-black shadow-sm';
  }
  return (
    <span className={cn("uppercase text-[8px] px-1.5 py-0.5 rounded tracking-wider whitespace-nowrap shrink-0 inline-flex items-center", colorClass)}>
      {text}
    </span>
  );
}

// Convert ratio string to CSS aspect-ratio class
function getAspectRatioClass(ratio: string): string {
  if (ratio === '9:16' || ratio === '720x1280' || ratio === '1:2') return 'aspect-[9/16]';
  if (ratio === '16:9' || ratio === '1280x720' || ratio === '2:1') return 'aspect-[16/9]';
  if (ratio === '3:4' || ratio === '784x1168') return 'aspect-[3/4]';
  if (ratio === '4:3' || ratio === '1168x784') return 'aspect-[4/3]';
  if (ratio === '2:3') return 'aspect-[2/3]';
  if (ratio === '3:2') return 'aspect-[3/2]';
  if (ratio === '4:5') return 'aspect-[4/5]';
  if (ratio === '5:4') return 'aspect-[5/4]';
  if (ratio === '21:9') return 'aspect-[21/9]';
  return 'aspect-square';
}

interface FlowProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  thumbnailUrl?: string;
}

interface CanvasCardItem {
  id: string;
  taskId: string;
  projectId?: string;
  mode: 'image' | 'video';
  prompt: string;
  model: string;
  ratio: string;
  quality: string;
  duration?: string;
  realPerson?: string;
  audio?: string;
  timestamp: number;
  attachments?: { url: string; type: 'image' | 'video' | 'audio' }[];
  status?: string;
  outputs?: { fileUrl: string; fileType: string }[];
}

// ─── Flow Gallery Video Player (Hover to Play + Manual Play Control + Zero AutoPlay) ──
function FlowVideoCard({
  src,
  onFullscreen,
}: {
  src: string;
  alt?: string;
  onFullscreen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Play smoothly on mouse enter, pause on leave
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Toggle play/pause manually on button click
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div 
      className="w-full h-full relative group/vcard overflow-hidden cursor-pointer bg-black"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onFullscreen}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        loop
        muted
        playsInline
        className="w-full h-full object-cover transition-transform duration-300 group-hover/vcard:scale-105"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Center Play/Pause button overlay */}
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-200 pointer-events-none",
          isPlaying && !isHovered ? "opacity-0" : "opacity-100"
        )}
      >
        <button
          type="button"
          onClick={handleTogglePlay}
          className={cn(
            "pointer-events-auto p-3.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white shadow-2xl transition-all duration-200 transform hover:scale-110 active:scale-95",
            isPlaying ? "hover:opacity-100 opacity-0 group-hover/vcard:opacity-90" : "opacity-100"
          )}
          title={isPlaying ? "Pause video" : "Play video"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-lime-400 fill-lime-400" />
          ) : (
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          )}
        </button>
      </div>

      {/* Video Badge indicator at bottom left */}
      <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-gray-300">
        <Film className="w-3 h-3 text-lime-400" />
        <span>{isPlaying ? 'PLAYING' : 'HOVER TO PLAY'}</span>
      </div>
    </div>
  );
}

function QuickCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addTask, tasks } = useTasks();
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Project Management State
  const [projects, setProjects] = useState<FlowProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isRenameProjectModalOpen, setIsRenameProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [renameProjectName, setRenameProjectName] = useState('');
  const [projectToRename, setProjectToRename] = useState<FlowProject | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [isInitialProjectsLoading, setIsInitialProjectsLoading] = useState(true);

  const [activeMode, setActiveMode] = useState<'image' | 'video'>(
    (searchParams.get('mode') as 'image' | 'video') || 'image'
  );
  const [prompt, setPrompt] = useState(searchParams.get('prompt') || '');
  const [selectedImageModel, setSelectedImageModel] = useState('nano-banana-2');
  const [selectedVideoModel, setSelectedVideoModel] = useState(VIDEO_MODELS[0].id);

  // Settings State
  const [ratio, setRatio] = useState('16:9');
  const [quality, setQuality] = useState('1k');
  const [duration, setDuration] = useState('6s');
  const [realPerson, setRealPerson] = useState('On');
  const [audio, setAudio] = useState('On');
  const [batchCount, setBatchCount] = useState<number>(1); // 1x, 2x, 3x, 4x

  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const mentionStartIndexRef = useRef<number | null>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);

  // Canvas Showcase items & Lightbox Preview state
  const [canvasItems, setCanvasItems] = useState<CanvasCardItem[]>([]);
  const syncedSessionsRef = useRef<Map<string, string>>(new Map());
  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<{
    url: string;
    type: 'image' | 'video';
    prompt?: string;
    model?: string;
    ratio?: string;
  } | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<{ url: string; type: 'image' | 'video' | 'audio' }[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<{ url: string; type: 'image' | 'video' | 'audio' }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAssetInspector, setShowAssetInspector] = useState(false);
  const [inputVideoDuration, setInputVideoDuration] = useState<number | null>(null); // seconds, detected from input video
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const ratioPopoverRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const assetInspectorRef = useRef<HTMLDivElement>(null);
  const mediaDeckRef = useRef<HTMLDivElement>(null);

  // Preview Lightbox Zoom & Pan State
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanningPreview, setIsPanningPreview] = useState(false);
  const previewPanStartRef = useRef({ startX: 0, startY: 0, initPanX: 0, initPanY: 0 });
  const previewViewportRef = useRef<HTMLDivElement>(null);

  // Global Outside-Click (Click-Away) Listener for Parameter & Project Popovers & Mention Popup & Asset Inspector
  useEffect(() => {
    const initialMode = searchParams.get('mode');
    if (initialMode === 'video') setActiveMode('video');
    else if (initialMode === 'image') setActiveMode('image');
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setIsModelOpen(false);
      }
      if (ratioPopoverRef.current && !ratioPopoverRef.current.contains(target)) {
        setIsRatioOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setIsProjectDropdownOpen(false);
      }
      if (mentionPopupRef.current && !mentionPopupRef.current.contains(target) && promptTextareaRef.current && !promptTextareaRef.current.contains(target)) {
        setShowMentionPopup(false);
      }
      if (
        assetInspectorRef.current &&
        !assetInspectorRef.current.contains(target) &&
        mediaDeckRef.current &&
        !mediaDeckRef.current.contains(target)
      ) {
        setShowAssetInspector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset Preview Modal Zoom & Lock Body Scroll & Keyboard Escape Handler
  useEffect(() => {
    if (!selectedPreviewMedia) {
      setPreviewZoom(1);
      setPreviewPan({ x: 0, y: 0 });
      setIsPanningPreview(false);
      return;
    }

    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setIsPanningPreview(false);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPreviewMedia(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPreviewMedia]);

  // Non-passive wheel zoom listener on preview viewport (prevents background scroll leak)
  useEffect(() => {
    const el = previewViewportRef.current;
    if (!el || !selectedPreviewMedia) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setPreviewZoom(prev => {
        const next = Math.max(1, Math.min(4, Math.round((prev + delta) * 100) / 100));
        if (next <= 1) {
          setPreviewPan({ x: 0, y: 0 });
        }
        return next;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [selectedPreviewMedia]);

  // Drag Panning for Preview Modal when zoomed in
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if (previewZoom <= 1) return;
    e.preventDefault();
    setIsPanningPreview(true);
    previewPanStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: previewPan.x,
      initPanY: previewPan.y,
    };
  };

  useEffect(() => {
    if (!isPanningPreview) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - previewPanStartRef.current.startX;
      const dy = e.clientY - previewPanStartRef.current.startY;
      const newX = previewPanStartRef.current.initPanX + dx;
      const newY = previewPanStartRef.current.initPanY + dy;

      const viewportEl = previewViewportRef.current;
      if (viewportEl) {
        const rect = viewportEl.getBoundingClientRect();
        const maxPanX = Math.max(0, (rect.width * (previewZoom - 1)) / 2);
        const maxPanY = Math.max(0, (rect.height * (previewZoom - 1)) / 2);
        setPreviewPan({
          x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
        });
      } else {
        setPreviewPan({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsPanningPreview(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanningPreview, previewZoom]);

  /** Detect duration of a video File using HTML5 media element */
  const detectVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const dur = Math.ceil(video.duration);
        URL.revokeObjectURL(url);
        resolve(dur);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      video.src = url;
    });
  };

  // Sync uploaded files with object URLs and perform resource cleanup on changes
  useEffect(() => {
    const urls = uploadedFiles.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image' as 'image' | 'video' | 'audio'
    }));
    setPreviewUrls(urls);

    // Detect duration of the first video file for smart Gemini video-edit duration
    const firstVideoFile = uploadedFiles.find(f => f.type.startsWith('video/'));
    if (firstVideoFile) {
      detectVideoDuration(firstVideoFile).then(dur => {
        setInputVideoDuration(dur > 0 ? dur : null);
      });
    } else {
      setInputVideoDuration(null);
    }

    return () => {
      urls.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, [uploadedFiles]);

  const currentVideoConfig = VIDEO_MODEL_CONFIGS[selectedVideoModel] || VIDEO_MODEL_CONFIGS['seedance-2.0-mini'];

  // Detect if we're in video-edit mode (Gemini + video input attached)
  const hasVideoAttached = attachedUrls.some(a => a.type === 'video') || uploadedFiles.some(f => f.type.startsWith('video/'));
  const isGeminiVideoEdit = selectedVideoModel === 'gemini-omni-flash' && hasVideoAttached && activeMode === 'video';

  // Compute available ratios based on active mode & model
  const currentAvailableRatios = activeMode === 'video'
    ? currentVideoConfig.ratios
    : (selectedImageModel === 'gpt-2.5-sunburst' || selectedImageModel === 'gpt-2.5-flare')
    ? GPT_25_IMAGE_RATIOS
    : selectedImageModel === 'nano-banana-2'
    ? NANO_BANANA_RATIOS
    : selectedImageModel === 'gpt-2.0'
    ? GPT_IMAGE_RATIOS
    : NANO_BANANA_RATIOS;

  const currentAvailableResolutions = activeMode === 'video'
    ? currentVideoConfig.resolutions
    : (selectedImageModel === 'gpt-2.5-sunburst' || selectedImageModel === 'gpt-2.5-flare')
    ? ['2k', '4k']
    : selectedImageModel === 'nano-banana-2-lite'
    ? ['1k']
    : IMAGE_QUALITIES;

  // Auto-adjust ratio and quality when model or mode changes
  useEffect(() => {
    if (currentAvailableRatios.length > 0 && !currentAvailableRatios.includes(ratio)) {
      setRatio(currentAvailableRatios[0]);
    }
    if (currentAvailableResolutions.length > 0 && !currentAvailableResolutions.includes(quality)) {
      setQuality(currentAvailableResolutions[0]);
    }
  }, [selectedImageModel, selectedVideoModel, activeMode, currentAvailableRatios, currentAvailableResolutions, ratio, quality]);

  // Authenticated user identity for project isolation
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user?.id) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(() => {});
  }, []);

  // Helpers to get/set active project in localStorage per user
  const getStoredProjectId = useCallback((userId: string): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`gaga_flow_active_project_${userId}`);
  }, []);

  const storeActiveProjectId = useCallback((userId: string, projId: string | null) => {
    if (typeof window === 'undefined') return;
    if (projId) {
      localStorage.setItem(`gaga_flow_active_project_${userId}`, projId);
    } else {
      localStorage.removeItem(`gaga_flow_active_project_${userId}`);
    }
  }, []);

  // Fetch real user-isolated projects
  const fetchUserProjects = useCallback(async (preferredProjectId?: string) => {
    if (!currentUserId) return;
    setIsInitialProjectsLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const projList: FlowProject[] = data.projects || [];
        setProjects(projList);

        if (projList.length > 0) {
          setActiveProjectId(prev => {
            // 1. If explicit preferred ID passed (e.g. after creation), prioritize it
            if (preferredProjectId && projList.some(p => p.id === preferredProjectId)) {
              storeActiveProjectId(currentUserId, preferredProjectId);
              return preferredProjectId;
            }
            // 2. Keep previous if valid
            if (prev && projList.some(p => p.id === prev)) {
              return prev;
            }
            // 3. Check localStorage
            const stored = getStoredProjectId(currentUserId);
            if (stored && projList.some(p => p.id === stored)) {
              return stored;
            }
            // 4. Fallback to first available real project
            const firstId = projList[0].id;
            storeActiveProjectId(currentUserId, firstId);
            return firstId;
          });
        }
      }
    } finally {
      setIsInitialProjectsLoading(false);
    }
  }, [currentUserId, getStoredProjectId, storeActiveProjectId]);

  useEffect(() => {
    if (currentUserId) {
      const urlProjectId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('projectId')
        : null;
      fetchUserProjects(urlProjectId || undefined);
    }
  }, [currentUserId, fetchUserProjects]);

  // ── Load canvas items scoped to active project & user (Smooth background refresh, no flicker) ───
  const loadProjectTasks = useCallback(async (projId: string | null, isSilent = false) => {
    if (!projId) return;
    if (!isSilent) {
      setIsProjectLoading(true);
    }
    try {
      const res = await fetch(`/api/sessions?projectId=${encodeURIComponent(projId)}`);
      let dbCanvasItems: CanvasCardItem[] = [];
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          dbCanvasItems = data.sessions.map((s: any) => {
            const isVid = s.mode === 'video';
            return {
              id: s.id,
              taskId: s.task_id || s.id,
              projectId: s.project_id || projId,
              mode: (isVid ? 'video' : 'image') as 'image' | 'video',
              prompt: s.prompt || 'Generation',
              model: isVid ? resolveVideoModelId(s.model) : resolveImageModelId(s.model),
              ratio: s.ratio || '16:9',
              quality: s.quality || '1k',
              duration: s.duration || '6s',
              realPerson: s.realPerson || 'On',
              audio: s.audio || 'On',
              timestamp: new Date(s.created_at || s.updated_at || Date.now()).getTime(),
              attachments: Array.isArray(s.attachments) ? s.attachments : [],
              status: s.status || (s.outputs && s.outputs.length > 0 ? 'SUCCESS' : 'QUEUED'),
              outputs: s.outputs || [],
            };
          });
        }
      }

      // Merge with active in-flight tasks from tasksRef
      const localMatching: CanvasCardItem[] = [];
      const currentTasks = tasksRef.current || [];
      for (const t of currentTasks) {
        const taskId = t.taskId || t.id;
        if (!taskId) continue;
        const infoMap: Record<string, string> = {};
        (t.nodeInfoList || []).forEach((n: any) => {
          if (n.fieldName && n.fieldValue) infoMap[n.fieldName] = n.fieldValue;
        });
        const isPending = t.status === 'RUNNING' || t.status === 'QUEUED';
        if (!isPending) continue;

        const taskProjId = infoMap.project_id || '';
        const isDefaultProj = projId.includes('default') || projId.includes('main');
        const isMatch = taskProjId === projId || (!taskProjId && isDefaultProj);
        if (isMatch && (t.appId?.includes('gaga-flow') || t.appId?.includes('quick-create'))) {
          if (!dbCanvasItems.some(i => i.taskId === taskId || i.id === taskId)) {
            const taskMode: 'image' | 'video' = infoMap.mode === 'video' || t.appId?.endsWith('video') ? 'video' : 'image';
            
            localMatching.push({
              id: t.id,
              taskId: taskId,
              projectId: projId,
              mode: taskMode,
              prompt: infoMap.prompt || infoMap.text || t.appName || 'Generation',
              model: infoMap.model || 'Standard',
              ratio: infoMap.ratio || '16:9',
              quality: infoMap.quality || '1k',
              timestamp: t.createdAt || Date.now(),
              status: t.status,
              outputs: t.outputs || [],
            });
          }
        }
      }

      const merged = [...dbCanvasItems, ...localMatching];
      // STRICT CHRONOLOGICAL ORDER: Newest creation timestamp first!
      merged.sort((a, b) => b.timestamp - a.timestamp);

      // Deduplicate strictly by taskId so that separate RunningHub generations with the same prompt/image are preserved
      const seenTaskIds = new Set<string>();
      const deduplicated: CanvasCardItem[] = [];

      for (const item of merged) {
        if (item.taskId) {
          if (seenTaskIds.has(item.taskId)) continue;
          seenTaskIds.add(item.taskId);
        }
        deduplicated.push(item);
      }

      setCanvasItems(deduplicated);
    } catch (e) {
      console.error('Failed to load project sessions:', e);
    } finally {
      if (!isSilent) {
        setIsProjectLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadProjectTasks(activeProjectId);
    }
  }, [activeProjectId, loadProjectTasks]);

  useEffect(() => {
    if (!activeProjectId) return;
    const timer = window.setInterval(() => {
      loadProjectTasks(activeProjectId, true);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [activeProjectId, loadProjectTasks]);

  // ── Create Project Handler ──────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      toast.success(`Project "${data.project.name}" created!`);
      setNewProjectName('');
      setNewProjectDesc('');
      setIsCreateProjectModalOpen(false);
      setIsProjectDropdownOpen(false);

      // Refresh list and select newly created project
      await fetchUserProjects(data.project.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  // ── Rename Project Handler ──────────────────────────────────────────
  const handleRenameProject = async () => {
    if (!projectToRename || !renameProjectName.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: projectToRename.id,
          name: renameProjectName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename project');

      toast.success(`Project renamed to "${data.project.name}"`);
      setIsRenameProjectModalOpen(false);
      setProjectToRename(null);
      setRenameProjectName('');

      await fetchUserProjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename project');
    }
  };

  // ── Delete Project Handler ──────────────────────────────────────────
  const handleDeleteProject = async (projId: string, projName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!confirm(`Are you sure you want to delete project "${projName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(projId)}`, { method: 'DELETE' });

      if (!res.ok) throw new Error('Failed to delete project');

      toast.success(`Project "${projName}" deleted`);
      await fetchUserProjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    }
  };

  // Sync active task updates with dedicated database endpoint (deduplicated)
  useEffect(() => {
    if (tasks.length === 0) return;

    let hasChanges = false;
    const completedOrFailedToSync: { id: string; taskId: string; status: string; outputs: any[]; error: any }[] = [];

    setCanvasItems(prev => {
      const existingIds = new Set(prev.map(i => i.taskId));
      const nextItems = prev.map(item => {
        const match = tasks.find(t => t.id === item.taskId || t.taskId === item.taskId);
        if (match && (match.status === 'SUCCESS' || match.status === 'FAILED')) {
          const syncKey = `${match.status}_${match.outputs?.length || 0}`;
          const lastSyncedKey = syncedSessionsRef.current.get(item.taskId);

          if (item.status !== match.status || (match.outputs && match.outputs.length !== (item.outputs?.length || 0))) {
            hasChanges = true;
            if (lastSyncedKey !== syncKey) {
              syncedSessionsRef.current.set(item.taskId, syncKey);
              completedOrFailedToSync.push({
                id: item.id,
                taskId: item.taskId,
                status: match.status,
                outputs: match.outputs || [],
                error: match.error || null,
              });
            }

            return {
              ...item,
              status: match.status,
              outputs: match.outputs || [],
              timestamp: item.timestamp || match.createdAt || Date.now(),
            };
          }
        }
        return item;
      });

      // Also check if any task in `tasks` matches this project and is not yet in `prev`
      const newlyDiscovered: CanvasCardItem[] = [];
      for (const t of tasks) {
        const taskId = t.taskId || t.id;
        if (taskId && !existingIds.has(taskId)) {
          // 1. STRICT FILTER: Only allow Gaga Flow tasks!
          const isFlowTask = t.appId?.includes('gaga-flow') || t.appId?.includes('quick-create');
          if (!isFlowTask) continue;

          // 2. Do NOT import if activeProjectId is not yet loaded or during initial project load
          if (!activeProjectId || isInitialProjectsLoading) continue;

          // 3. Only import in-flight pending tasks (RUNNING / QUEUED) into canvas state via this hook!
          // Completed sessions are loaded authoritatively from /api/sessions
          const isPending = t.status === 'RUNNING' || t.status === 'QUEUED';
          if (!isPending) continue;

          const infoMap: Record<string, string> = {};
          (t.nodeInfoList || []).forEach((n: any) => {
            if (n.fieldName && n.fieldValue) infoMap[n.fieldName] = n.fieldValue;
          });
          const taskProjId = infoMap.project_id || '';
          const isDefaultProj = activeProjectId.includes('default') || activeProjectId.includes('main');
          const isMatch = taskProjId === activeProjectId || (!taskProjId && isDefaultProj);

          if (isMatch) {
            newlyDiscovered.push({
              id: t.id,
              taskId,
              projectId: activeProjectId,
              mode: infoMap.mode === 'video' || t.appId?.endsWith('video') ? 'video' : 'image',
              prompt: infoMap.prompt || infoMap.text || t.appName || 'Generation',
              model: infoMap.model || 'Standard',
              ratio: infoMap.ratio || '16:9',
              quality: infoMap.quality || '1k',
              timestamp: t.createdAt || Date.now(),
              status: t.status,
              outputs: t.outputs || [],
            });
            existingIds.add(taskId);
            hasChanges = true;
          }
        }
      }

      if (!hasChanges) return prev;
      const combined = [...newlyDiscovered, ...nextItems].sort((a, b) => b.timestamp - a.timestamp);

      // Deduplicate combined strictly by taskId so real RunningHub tasks are never suppressed
      const seenIds = new Set<string>();
      const deduped: CanvasCardItem[] = [];

      for (const item of combined) {
        if (item.taskId && seenIds.has(item.taskId)) continue;
        if (item.taskId) seenIds.add(item.taskId);
        deduped.push(item);
      }

      return deduped;
    });

    // Fire PUT requests cleanly once per task outside the React state reducer
    if (completedOrFailedToSync.length > 0) {
      completedOrFailedToSync.forEach(syncItem => {
        fetch('/api/sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: syncItem.id,
            task_id: syncItem.taskId,
            project_id: activeProjectId,
            status: syncItem.status,
            outputs: syncItem.outputs,
            error: syncItem.error,
          }),
        }).then(() => {
          if (activeProjectId) loadProjectTasks(activeProjectId, true);
        }).catch(() => {});
      });
    }
  }, [tasks, activeProjectId, isInitialProjectsLoading]);

  // Auto-resize the prompt textarea height to fit long prompts dynamically
  useEffect(() => {
    if (promptTextareaRef.current) {
      const textarea = promptTextareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [prompt]);

  // Reset video parameters if they don't match the selected video model's supported enums
  useEffect(() => {
    if (activeMode === 'video') {
      const config = VIDEO_MODEL_CONFIGS[selectedVideoModel];
      if (config) {
        if (!config.resolutions.includes(quality)) {
          setQuality(config.defaultResolution);
        }
        if (!config.ratios.includes(ratio)) {
          setRatio(config.ratios[0]);
        }
        if (config.durationMode === 'slider') {
          const num = parseInt(duration, 10);
          if (isNaN(num) || num < (config.minDuration || 4) || num > (config.maxDuration || 15)) {
            setDuration(config.defaultDuration);
          }
        } else {
          if (!config.durations.includes(duration)) {
            setDuration(config.defaultDuration);
          }
        }
      }
    }
  }, [selectedVideoModel, activeMode]);

  // Handle initial submission from URL params
  const initialTriggerRef = useRef(false);
  useEffect(() => {
    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt && !initialTriggerRef.current) {
      initialTriggerRef.current = true;
      handleGenerate(urlPrompt);
    }
  }, [searchParams]);

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'));
    if (validFiles.length === 0) {
      toast.error('Please upload images, videos, or audio files.');
      return;
    }
    setUploadedFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const types = e.dataTransfer.types;
    const hasFiles = types.includes('Files') || types.includes('application/json') || types.includes('text/plain') || types.includes('text/uri-list');
    if (hasFiles) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Drag & drop into control dock (Supports OS files AND generated card outputs)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // 1. Check if dragging files from OS
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
      return;
    }

    // 2. Check if dragging JSON item from generated canvas card
    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.url && typeof parsed.url === 'string' && !parsed.url.startsWith('blob:')) {
          const mediaType: 'image' | 'video' | 'audio' = parsed.type === 'video' ? 'video' : parsed.type === 'audio' ? 'audio' : 'image';
          setAttachedUrls(prev => [...prev.filter(p => !p.url.startsWith('blob:')), { url: parsed.url, type: mediaType }].slice(0, 5));
          toast.success('Added generated result to reference assets!');
          return;
        }
      } catch {}
    }

    // 3. Fallback plain text URL
    const textUrl = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (textUrl && (textUrl.startsWith('http') || textUrl.startsWith('/')) && !textUrl.startsWith('blob:')) {
      const isVid = textUrl.endsWith('.mp4') || textUrl.endsWith('.webm');
      const mediaType: 'image' | 'video' | 'audio' = isVid ? 'video' : 'image';
      setAttachedUrls(prev => [...prev.filter(p => !p.url.startsWith('blob:')), { url: textUrl, type: mediaType }].slice(0, 5));
      toast.success('Added generated result to reference assets!');
    }
  };

  // ─── SaaS Standard Prompt Box Helpers ─────────────────────────────────────
  // 1. Auto-resize prompt textarea dynamically as user types
  useEffect(() => {
    if (promptTextareaRef.current) {
      const textarea = promptTextareaRef.current;
      textarea.style.height = 'auto';
      const calculatedHeight = Math.min(Math.max(textarea.scrollHeight, 40), 180);
      textarea.style.height = `${calculatedHeight}px`;
    }
  }, [prompt]);

  // 2. Compute available attached media for @ mentions (dock uploads + project gallery assets)
  const availableMedia = useMemo(() => {
    // 1. Attached in dock (previews and URLs)
    const dockItems = [...previewUrls, ...attachedUrls].map((item) => ({
      url: item.url,
      type: item.type,
      source: 'dock' as const,
    }));

    // 2. Completed Canvas Assets from current project
    const projectAssets: { url: string; type: 'image' | 'video' | 'audio'; source: 'project' }[] = [];
    canvasItems.forEach((item) => {
      const taskObj = tasks.find(t => t.id === item.taskId || t.taskId === item.taskId);
      const isSuccess = taskObj?.status === 'SUCCESS' || item.status === 'SUCCESS' || (item.outputs && item.outputs.length > 0);
      const outputs = (taskObj?.outputs && taskObj.outputs.length > 0) ? taskObj.outputs : (item.outputs || []);
      if (isSuccess && outputs.length > 0 && outputs[0]?.fileUrl) {
        const fileUrl = outputs[0].fileUrl;
        const isVideo = item.mode === 'video' || fileUrl.includes('.mp4') || fileUrl.includes('.webm') || fileUrl.includes('.mov');
        // Avoid duplicates if already in dock
        if (!dockItems.some(d => d.url === fileUrl) && !projectAssets.some(p => p.url === fileUrl)) {
          projectAssets.push({
            url: fileUrl,
            type: isVideo ? 'video' : 'image',
            source: 'project'
          });
        }
      }
    });

    const combined = [...dockItems, ...projectAssets];
    const typeIndexes: Record<'image' | 'video' | 'audio', number> = { image: 0, video: 0, audio: 0 };
    return combined.map((item) => {
      const mediaIndex = ++typeIndexes[item.type];
      const tagLabel = item.type.includes('video')
        ? `Video ${mediaIndex}`
        : item.type.includes('audio')
        ? `Audio ${mediaIndex}`
        : `Image ${mediaIndex}`;
      return { ...item, tagLabel, index: mediaIndex };
    });
  }, [previewUrls, attachedUrls, canvasItems, tasks]);

  // 3. Filtered media based on user's active query after '@'
  const filteredMedia = useMemo(() => {
    if (!mentionQuery) return availableMedia;
    const q = mentionQuery.toLowerCase().trim();
    return availableMedia.filter(m => 
      m.tagLabel.toLowerCase().includes(q) || 
      m.type.toLowerCase().includes(q) ||
      `${m.index}` === q
    );
  }, [availableMedia, mentionQuery]);

  // 4. Stable Mention Insertion with Rock-Solid Cursor & Scroll Preservation
  const insertMention = useCallback((item: { tagLabel: string; type: string; url: string }) => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;

    const tagText = `@${item.tagLabel} `;
    const currentScroll = textarea.scrollTop;
    const currentText = textarea.value;
    const cursorPos = textarea.selectionStart ?? currentText.length;

    // Detect target '@' start position
    const textBeforeCursor = currentText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

    let beforeAt = textBeforeCursor;
    let afterAt = currentText.slice(cursorPos);

    if (atMatch && atMatch.index !== undefined) {
      beforeAt = textBeforeCursor.slice(0, atMatch.index);
    } else if (mentionStartIndexRef.current !== null && mentionStartIndexRef.current >= 0) {
      beforeAt = currentText.slice(0, mentionStartIndexRef.current);
      afterAt = currentText.slice(cursorPos);
    }

    const updatedText = beforeAt + tagText + afterAt;
    const newCursorPos = beforeAt.length + tagText.length;

    setPrompt(updatedText);
    setShowMentionPopup(false);
    setMentionQuery('');
    setActiveMentionIndex(0);
    mentionStartIndexRef.current = null;

    // Retain textarea focus and exact cursor & scroll position post-render
    requestAnimationFrame(() => {
      if (promptTextareaRef.current) {
        promptTextareaRef.current.focus();
        promptTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        promptTextareaRef.current.scrollTop = currentScroll;
      }
    });
  }, []);

  // ─── Reuse Prompt & Settings Function ─────────────────────────────────────
  const handleReusePrompt = (item: CanvasCardItem) => {
    // 1. Restore Prompt (Filter out technical backend route names like /edit or /economy)
    const rawPrompt = (item.prompt || '').trim();
    const isTechnicalRoute = 
      rawPrompt.includes('/edit') || 
      rawPrompt.includes('/economy') || 
      rawPrompt.includes('gpt-image-2.0') || 
      rawPrompt.includes('f-2-klein-9b') ||
      rawPrompt.toLowerCase() === 'generation' ||
      rawPrompt.toLowerCase() === 'standard';

    setPrompt(isTechnicalRoute ? '' : rawPrompt);

    // 2. Restore Mode & Model with robust ID resolution
    const mode = item.mode || 'image';
    setActiveMode(mode);

    if (mode === 'image') {
      const resolvedModel = resolveImageModelId(item.model);
      setSelectedImageModel(resolvedModel);
    } else {
      const resolvedModel = resolveVideoModelId(item.model);
      setSelectedVideoModel(resolvedModel);
    }

    // 3. Restore Ratio & Resolution
    if (item.ratio) setRatio(item.ratio);
    if (item.quality) setQuality(item.quality);

    // 4. Restore Video Specific Settings
    if (item.duration) setDuration(item.duration);
    if (item.realPerson) setRealPerson(item.realPerson === 'Off' ? 'Off' : 'On');
    if (item.audio) setAudio(item.audio === 'Off' ? 'Off' : 'On');

    // 5. Restore Media Assets into 'Add Media' (Reference Image/Video Deck)
    setUploadedFiles([]);
    let mediaToRestore: { url: string; type: 'image' | 'video' | 'audio' }[] = [];

    if (item.attachments && item.attachments.length > 0) {
      mediaToRestore = item.attachments.filter(a => a && a.url && typeof a.url === 'string' && a.url.trim().length > 0 && !a.url.startsWith('blob:') && !a.url.startsWith('undefined') && !a.url.startsWith('null'));
    } else if (item.outputs && item.outputs.length > 0) {
      // Fallback: Populate generated output image as reference asset so Add Media is never blank
      const firstOut = item.outputs[0];
      const outUrl = firstOut.fileUrl || (firstOut as any).url || (firstOut as any).outputUrl;
      if (outUrl && typeof outUrl === 'string' && !outUrl.startsWith('blob:') && !outUrl.startsWith('undefined') && !outUrl.startsWith('null')) {
        mediaToRestore = [{
          url: outUrl,
          type: item.mode === 'video' ? 'video' : 'image',
        }];
      }
    }
    setAttachedUrls(mediaToRestore);

    // 6. Focus prompt textarea, place cursor at end, and scroll smoothly into view
    setTimeout(() => {
      if (promptTextareaRef.current) {
        promptTextareaRef.current.focus();
        const len = promptTextareaRef.current.value.length;
        promptTextareaRef.current.setSelectionRange(len, len);
        promptTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 50);

    toast.success('Restored prompt, reference media & generation parameters!');
  };

  const handleGenerate = async (overridePrompt?: string) => {
    const currentPrompt = (overridePrompt || prompt).trim();
    if (!currentPrompt && uploadedFiles.length === 0 && attachedUrls.length === 0) {
      toast.error('Please enter a prompt or attach media.');
      return;
    }

    setIsGenerating(true);
    try {
      const allAttachments: { url: string; type: 'image' | 'video' | 'audio' }[] = attachedUrls.filter(a => a && a.url && typeof a.url === 'string' && a.url.trim().length > 0 && !a.url.startsWith('blob:') && !a.url.startsWith('undefined') && !a.url.startsWith('null'));
      const imageUrls: string[] = allAttachments.filter(a => a.type === 'image').map(a => a.url);
      const videoUrls: string[] = allAttachments.filter(a => a.type === 'video').map(a => a.url);
      const audioUrls: string[] = allAttachments.filter(a => a.type === 'audio').map(a => a.url);

      // Track preview blob URL -> uploaded public URL mapping
      const blobToUploadedUrl = new Map<string, string>();

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const previewObj = previewUrls[i];
        const previewUrl = previewObj?.url;

        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.fileUrl) throw new Error(data.error || 'File upload failed');

        if (previewUrl) {
          blobToUploadedUrl.set(previewUrl, data.fileUrl);
        }

        let fileType: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video/')) {
          fileType = 'video';
          if (!videoUrls.includes(data.fileUrl)) videoUrls.push(data.fileUrl);
        } else if (file.type.startsWith('audio/')) {
          fileType = 'audio';
          if (!audioUrls.includes(data.fileUrl)) audioUrls.push(data.fileUrl);
        } else {
          if (!imageUrls.includes(data.fileUrl)) imageUrls.push(data.fileUrl);
        }

        allAttachments.push({ url: data.fileUrl, type: fileType });
      }

      const activeModel = activeMode === 'image' ? selectedImageModel : selectedVideoModel;

      // Resolve prompt mentions to actual uploaded URLs / gallery assets for the API call
      let processedPrompt = currentPrompt;

      // Extract referenced media from availableMedia into generation payload arrays
      availableMedia.forEach((mediaItem) => {
        const tagRegex = new RegExp(`@${mediaItem.tagLabel.replace(/\s+/g, '\\s*')}\\b`, 'gi');
        const altRegex = mediaItem.type === 'image'
          ? new RegExp(`@(Image|img)\\s*${mediaItem.index}\\b`, 'gi')
          : mediaItem.type === 'video'
          ? new RegExp(`@(Video|vid)\\s*${mediaItem.index}\\b`, 'gi')
          : new RegExp(`@(Audio|aud)\\s*${mediaItem.index}\\b`, 'gi');

        if (tagRegex.test(currentPrompt) || altRegex.test(currentPrompt)) {
          // Resolve blob URL to real uploaded URL if available
          const effectiveUrl = blobToUploadedUrl.get(mediaItem.url) || mediaItem.url;

          // Strictly prevent browser-only blob: URLs from leaking into generation payloads
          if (effectiveUrl && !effectiveUrl.startsWith('blob:')) {
            if (mediaItem.type === 'image' && !imageUrls.includes(effectiveUrl)) {
              imageUrls.push(effectiveUrl);
            } else if (mediaItem.type === 'video' && !videoUrls.includes(effectiveUrl)) {
              videoUrls.push(effectiveUrl);
            } else if (mediaItem.type === 'audio' && !audioUrls.includes(effectiveUrl)) {
              audioUrls.push(effectiveUrl);
            }
            if (!allAttachments.some(a => a.url === effectiveUrl)) {
              allAttachments.push({ url: effectiveUrl, type: mediaItem.type });
            }
          }
           const referenceLabel = mediaItem.type === 'video' ? 'the reference video' : mediaItem.type === 'audio' ? 'the reference audio' : 'the reference image';
           processedPrompt = processedPrompt.replace(tagRegex, referenceLabel);
           processedPrompt = processedPrompt.replace(altRegex, referenceLabel);
        }
      });

      // Final sanitization: strip any stray blob, undefined, or null URLs
      const cleanImageUrls = imageUrls.filter(u => u && typeof u === 'string' && u.trim().length > 0 && !u.startsWith('blob:') && !u.startsWith('undefined') && !u.startsWith('null'));
      const cleanVideoUrls = videoUrls.filter(u => u && typeof u === 'string' && u.trim().length > 0 && !u.startsWith('blob:') && !u.startsWith('undefined') && !u.startsWith('null'));
      const cleanAudioUrls = audioUrls.filter(u => u && typeof u === 'string' && u.trim().length > 0 && !u.startsWith('blob:') && !u.startsWith('undefined') && !u.startsWith('null'));
      const cleanAttachments = allAttachments.filter(a => a && a.url && typeof a.url === 'string' && a.url.trim().length > 0 && !a.url.startsWith('blob:') && !a.url.startsWith('undefined') && !a.url.startsWith('null'));

      // Ensure active project or auto-create one seamlessly if user generated without creating a project
      let targetProjectId = activeProjectId;
      if (!targetProjectId) {
        const initialProjName = prompt.trim() ? `${prompt.trim().slice(0, 24)} Flow` : 'My Creative Flow';
        try {
          const createRes = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: initialProjName }),
          });
          const createData = await createRes.json();
          if (createData?.project?.id) {
            targetProjectId = createData.project.id;
            setActiveProjectId(targetProjectId);
            if (currentUserId) storeActiveProjectId(currentUserId, targetProjectId);
            fetchUserProjects(createData.project.id);
          }
        } catch {}
      }
      if (targetProjectId?.startsWith('flow_proj_default_')) {
        const createRes = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: prompt.trim() ? `${prompt.trim().slice(0, 24)} Flow` : 'My Creative Flow' }) });
        const created = await createRes.json();
        if (!createRes.ok || !created.project?.id) throw new Error(created.error || 'Could not create a Flow project');
        targetProjectId = created.project.id;
        setActiveProjectId(targetProjectId);
        if (currentUserId) storeActiveProjectId(currentUserId, targetProjectId);
        await fetchUserProjects(targetProjectId || undefined);
      }

      const effectiveBatchCount = activeMode === 'video' && !ENABLE_VIDEO_BATCH ? 1 : batchCount;
      // Process batch generation (1x to 4x) cleanly without endpoint collisions
      for (let b = 0; b < effectiveBatchCount; b++) {
        if (b > 0) {
          await new Promise(r => setTimeout(r, 250));
        }

        let taskId = '';
        if (activeMode === 'image') {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'image',
              prompt: processedPrompt,
              model: selectedImageModel,
              aspectRatio: ratio !== 'Auto' ? ratio : '16:9',
              resolution: quality,
              imageUrls: cleanImageUrls.length > 0 ? cleanImageUrls : undefined,
              projectId: targetProjectId,
              attachments: cleanAttachments,
              generateAudio: audio === 'On',
              realPersonMode: realPerson === 'On',
              appId: 'gaga-flow-image',
              appName: `Image: ${currentPrompt.slice(0, 25)}...`,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.taskId) throw new Error(data.errorMessage || data.error || 'Image generation failed');
          taskId = data.taskId;

          addTask(
            taskId,
            `gaga-flow-image`,
            `Image: ${currentPrompt.slice(0, 25)}...`,
            [
              { nodeId: 'prompt', fieldName: 'prompt', fieldValue: currentPrompt },
              { nodeId: 'text', fieldName: 'text', fieldValue: processedPrompt },
              { nodeId: 'project', fieldName: 'project_id', fieldValue: targetProjectId || '' },
              { nodeId: 'model', fieldName: 'model', fieldValue: selectedImageModel },
              { nodeId: 'mode', fieldName: 'mode', fieldValue: 'image' },
              { nodeId: 'ratio', fieldName: 'ratio', fieldValue: ratio },
              { nodeId: 'quality', fieldName: 'quality', fieldValue: quality },
              { nodeId: 'attachments', fieldName: 'attachments', fieldValue: JSON.stringify(cleanAttachments) },
            ],
            'enterprise'
          );
        } else {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'video',
              model: selectedVideoModel,
              prompt: processedPrompt,
              imageUrls: cleanImageUrls.length > 0 ? cleanImageUrls : undefined,
              videoUrls: cleanVideoUrls.length > 0 ? cleanVideoUrls : undefined,
              audioUrls: cleanAudioUrls.length > 0 ? cleanAudioUrls : undefined,
              aspectRatio: ratio !== 'Auto' ? ratio : undefined,
              resolution: quality,
              duration,
              projectId: targetProjectId,
              attachments: cleanAttachments,
              // Pass detected input video duration so backend can snap to correct supported value
              inputVideoDuration: inputVideoDuration ?? undefined,
              realPersonMode: realPerson === 'On',
              generateAudio: audio === 'On',
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.taskId) throw new Error(data.errorMessage || data.error || 'Video generation failed');
          taskId = data.taskId;

          addTask(
            taskId,
            `gaga-flow-video`,
            `Video: ${currentPrompt.slice(0, 25)}...`,
            [
              { nodeId: 'prompt', fieldName: 'prompt', fieldValue: currentPrompt },
              { nodeId: 'text', fieldName: 'text', fieldValue: processedPrompt },
              { nodeId: 'project', fieldName: 'project_id', fieldValue: targetProjectId || '' },
              { nodeId: 'model', fieldName: 'model', fieldValue: selectedVideoModel },
              { nodeId: 'mode', fieldName: 'mode', fieldValue: 'video' },
              { nodeId: 'ratio', fieldName: 'ratio', fieldValue: ratio },
              { nodeId: 'quality', fieldName: 'quality', fieldValue: quality },
              { nodeId: 'duration', fieldName: 'duration', fieldValue: duration },
              { nodeId: 'realPerson', fieldName: 'realPerson', fieldValue: realPerson },
              { nodeId: 'audio', fieldName: 'audio', fieldValue: audio },
              { nodeId: 'attachments', fieldName: 'attachments', fieldValue: JSON.stringify(cleanAttachments) },
            ],
            'enterprise'
          );
        }

        const localId = `${Date.now()}-${b}-canvas`;

        // Persist to the dedicated Gaga Flow history table
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: localId,
            task_id: taskId,
            project_id: targetProjectId,
            mode: activeMode,
            prompt: currentPrompt,
            model: activeModel,
            ratio,
            quality,
            duration,
            realPerson,
            audio,
            attachments: allAttachments,
            status: 'QUEUED',
          })
        }).catch(() => {});

        // Add to Canvas Item List at top position
        const newCanvasItem: CanvasCardItem = {
          id: localId,
          taskId,
          projectId: activeProjectId || undefined,
          mode: activeMode,
          prompt: currentPrompt,
          model: activeModel,
          ratio,
          quality,
          duration,
          realPerson,
          audio,
          timestamp: Date.now(),
          attachments: allAttachments,
          status: 'QUEUED',
          outputs: [],
        };

        setCanvasItems(prev => [newCanvasItem, ...prev]);

        // Optimistically update project item count in local state
        if (activeProjectId) {
          setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, itemCount: (p.itemCount || 0) + 1 } : p));
        }
      }

      setPrompt('');
      setUploadedFiles([]);
      setAttachedUrls([]);
      toast.success(`Generating ${effectiveBatchCount}x ${activeMode}...`);

    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // State and handler for single tile retry (ID 8)
  const [retryingCardId, setRetryingCardId] = useState<string | null>(null);

  const handleRetryCard = async (item: CanvasCardItem) => {
    setRetryingCardId(item.id);
    try {
      let taskId = '';
      if (item.mode === 'image') {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'image',
            prompt: item.prompt,
            model: item.model || 'nano-banana-2',
            aspectRatio: item.ratio !== 'Auto' ? item.ratio : '16:9',
            resolution: item.quality || '1K',
            projectId: item.projectId || activeProjectId,
            appId: 'gaga-flow-image',
            appName: `Image: ${item.prompt.slice(0, 25)}...`,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.taskId) throw new Error(data.errorMessage || data.error || 'Retry failed');
        taskId = data.taskId;

        addTask(
          taskId,
            `gaga-flow-image`,
          `Image: ${item.prompt.slice(0, 25)}...`,
          [
            { nodeId: 'prompt', fieldName: 'prompt', fieldValue: item.prompt },
            { nodeId: 'project', fieldName: 'project_id', fieldValue: item.projectId || activeProjectId || '' },
            { nodeId: 'model', fieldName: 'model', fieldValue: item.model },
            { nodeId: 'mode', fieldName: 'mode', fieldValue: 'image' },
            { nodeId: 'ratio', fieldName: 'ratio', fieldValue: item.ratio },
            { nodeId: 'quality', fieldName: 'quality', fieldValue: item.quality },
          ],
          'enterprise'
        );
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'video',
            model: item.model || 'seedance-2.0-mini',
            prompt: item.prompt,
            imageUrls: item.attachments?.filter(a => a.type === 'image').map(a => a.url),
            videoUrls: item.attachments?.filter(a => a.type === 'video').map(a => a.url),
            audioUrls: item.attachments?.filter(a => a.type === 'audio').map(a => a.url),
            projectId: item.projectId || activeProjectId,
            attachments: item.attachments || [],
            aspectRatio: item.ratio !== 'Auto' ? item.ratio : undefined,
            resolution: item.quality,
            duration: item.duration,
            realPerson: item.realPerson === 'On',
            audio: item.audio === 'On',
            generateAudio: item.audio === 'On',
            realPersonMode: item.realPerson === 'On',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.taskId) throw new Error(data.errorMessage || data.error || 'Retry failed');
        taskId = data.taskId;

        addTask(
          taskId,
            `gaga-flow-video`,
          `Video: ${item.prompt.slice(0, 25)}...`,
          [
            { nodeId: 'prompt', fieldName: 'prompt', fieldValue: item.prompt },
            { nodeId: 'project', fieldName: 'project_id', fieldValue: item.projectId || activeProjectId || '' },
            { nodeId: 'model', fieldName: 'model', fieldValue: item.model },
            { nodeId: 'mode', fieldName: 'mode', fieldValue: 'video' },
            { nodeId: 'ratio', fieldName: 'ratio', fieldValue: item.ratio },
            { nodeId: 'quality', fieldName: 'quality', fieldValue: item.quality },
            { nodeId: 'duration', fieldName: 'duration', fieldValue: item.duration || '6s' },
          ],
          'enterprise'
        );
      }

      // Update the canvas item in-place so it transitions to QUEUED state with the new taskId
      setCanvasItems(prev => prev.map(ci => {
        if (ci.id === item.id) {
          return {
            ...ci,
            taskId,
            status: 'QUEUED',
            outputs: [],
          };
        }
        return ci;
      }));

      // Update session record in DB asynchronously
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `${Date.now()}-retry-canvas`,
          task_id: taskId,
          project_id: item.projectId || activeProjectId,
          mode: item.mode,
          prompt: item.prompt,
          model: item.model,
          ratio: item.ratio,
          quality: item.quality,
          duration: item.duration,
          status: 'QUEUED',
          attachments: item.attachments || [],
        })
      }).catch(() => {});

      toast.success('Retrying generation for this tile...');
    } catch (err: any) {
      toast.error(err.message || 'Retry failed');
    } finally {
      setRetryingCardId(null);
    }
  };

  const activeModelObj = activeMode === 'image'
    ? IMAGE_MODELS.find(m => m.id === selectedImageModel)
    : VIDEO_MODELS.find(m => m.id === selectedVideoModel);

  return (
    <div className="creative-flow-shell flex h-screen bg-[#070707] text-white overflow-hidden font-sans">
      <GagaSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative bg-[#070707]">
        {/* Viewport-fixed background gradient to avoid background color splits/cuts on scroll */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-lime-950/15 via-[#070707] to-[#070707] pointer-events-none z-0" />

        {/* Main Background Canvas Workspace */}
        <main className="flex-1 overflow-y-auto relative flex flex-col p-4 sm:p-6 pb-28 z-10">

          {/* Top Back Navigation Bar */}
          <div className="relative z-20 w-full max-w-5xl mx-auto flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold transition-all shadow-sm group cursor-pointer"
              title="Go back to previous page"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
          </div>

          {/* Top Banner Heading */}
          <div className="relative z-10 text-center space-y-1 pt-1 flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl font-black text-lime-400 tracking-tight drop-shadow-[0_0_20px_rgba(163,230,53,0.3)]">
              Gaga Creative Flow
            </h1>
            <p className="text-xs text-gray-400 font-medium tracking-wide max-w-2xl">
              Transform creative prompts into commercial visuals and cinematic campaign assets instantly.
            </p>
          </div>

          {/* Project Switcher & Workspace Control Bar */}
          <div className="relative z-30 w-full max-w-5xl mx-auto mt-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 bg-[#121316]/90 border border-white/[0.08] rounded-2xl shadow-xl backdrop-blur-xl">
            {/* Active Project Dropdown */}
            <div className="relative w-full sm:w-auto flex items-center gap-2" ref={projectDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-lime-500/40 text-left transition-all text-xs group"
                >
                  <div className="w-7 h-7 rounded-lg bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-zinc-400 font-mono block uppercase">Active Campaign Project</span>
                    <span className="font-bold text-white block max-w-[220px] truncate text-xs">
                      {projects.find(p => p.id === activeProjectId)?.name || (projects.length > 0 ? projects[0].name : 'No Project Selected')}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-zinc-400 ml-1 transition-transform", isProjectDropdownOpen && "rotate-180")} />
                </button>

                {/* Dropdown Menu */}
                {isProjectDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 sm:w-84 bg-[#15161a] border border-white/[0.12] rounded-2xl shadow-2xl p-2 z-50 space-y-2 backdrop-blur-2xl">
                    <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-white/[0.06]">
                      <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase">My Flow Projects</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{projects.length} Projects</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                      {projects.length === 0 ? (
                        <div className="py-6 px-3 text-center space-y-1 text-zinc-500 text-xs">
                          <p className="font-semibold text-zinc-400">No projects yet</p>
                          <p className="text-[11px]">Create a project to organize your visual generations.</p>
                        </div>
                      ) : (
                        projects.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setActiveProjectId(p.id);
                              if (currentUserId) storeActiveProjectId(currentUserId, p.id);
                              setIsProjectDropdownOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs",
                              activeProjectId === p.id ? "bg-lime-400/15 border border-lime-400/30 text-lime-300" : "hover:bg-white/[0.04] text-zinc-300"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Folder className={cn("w-4 h-4 shrink-0", activeProjectId === p.id ? "text-lime-400" : "text-zinc-500")} />
                              <div className="min-w-0">
                                <span className="font-bold block truncate">{p.name}</span>
                                <span className="text-[10px] text-zinc-500 font-mono block">
                                  {p.itemCount || 0} assets • {new Date(p.updatedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setProjectToRename(p);
                                  setRenameProjectName(p.name);
                                  setIsRenameProjectModalOpen(true);
                                  setIsProjectDropdownOpen(false);
                                }}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                                title="Rename Project"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteProject(p.id, p.name, e)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Project"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateProjectModalOpen(true);
                        setIsProjectDropdownOpen(false);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-lime-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-lime-300 transition-all shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Project</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions: + New Project & Asset count */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {(() => {
                const successfulAssetCount = canvasItems.filter(item => {
                  const taskObj = tasks.find(t => t.id === item.taskId || t.taskId === item.taskId);
                  return taskObj?.status === 'SUCCESS' || item.status === 'SUCCESS' || (item.outputs && item.outputs.length > 0);
                }).length;
                return (
                  <span className="text-xs font-mono text-zinc-400 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <strong className="text-white">{successfulAssetCount}</strong> project assets
                  </span>
                );
              })()}

              <button
                type="button"
                onClick={() => setIsCreateProjectModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime-400 text-black font-extrabold text-xs hover:bg-lime-300 transition-all shadow-lg shadow-lime-400/15"
              >
                <FolderPlus className="w-4 h-4" />
                <span>+ New Project</span>
              </button>
            </div>
          </div>

          {/* Canvas Showcase Gallery */}
          <div className="relative z-10 w-full mt-2 mb-4">
            {isInitialProjectsLoading || isProjectLoading ? (
              <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400 shadow-xl shadow-lime-400/10">
                  <Loader2 className="w-6 h-6 animate-spin text-lime-400" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-300 block">Loading Project Workspace...</span>
                  <span className="text-[10px] text-gray-500 font-mono block">Syncing project visual assets</span>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 p-8 rounded-3xl bg-white/[0.01] border border-dashed border-white/10 max-w-lg mx-auto my-8 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400 shadow-xl shadow-lime-400/10">
                  <FolderPlus className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">No Projects Created Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    Create a dedicated project folder to organize your visual AI generations, campaign assets, and references.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lime-400 text-black font-extrabold text-xs hover:bg-lime-300 transition-all shadow-lg shadow-lime-400/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Project</span>
                </button>
              </div>
            ) : canvasItems.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 p-6 rounded-3xl bg-white/[0.01] border border-dashed border-white/10 max-w-md mx-auto my-6 animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-zinc-500">
                  <FolderKanban className="w-7 h-7 text-lime-400/50" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Project workspace is ready</h4>
                  <p className="text-xs text-zinc-400">
                    No generations yet in <span className="text-lime-300 font-bold">{projects.find(p => p.id === activeProjectId)?.name || 'this project'}</span>. Enter a prompt below to create your first visual asset.
                  </p>
                </div>
              </div>
            ) : null}

            {!isInitialProjectsLoading && !isProjectLoading && canvasItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 items-start animate-in fade-in duration-300">
                {canvasItems.map((item) => {
                  const taskObj = tasks.find(t => t.id === item.taskId || t.taskId === item.taskId);
                  const isSuccess = taskObj?.status === 'SUCCESS' || item.status === 'SUCCESS' || (item.outputs && item.outputs.length > 0);
                  const isFailed = taskObj?.status === 'FAILED' || (item.status === 'FAILED' && (!item.outputs || item.outputs.length === 0));
                  const outputs = (taskObj?.outputs && taskObj.outputs.length > 0) ? taskObj.outputs : (item.outputs || []);

                  const aspectClass = getAspectRatioClass(item.ratio);
                  const mediaType = item.mode === 'video' || (outputs[0]?.fileUrl && (outputs[0].fileUrl.toLowerCase().includes('.mp4') || outputs[0].fileUrl.toLowerCase().includes('.webm') || outputs[0].fileUrl.toLowerCase().includes('.mov'))) ? 'video' : 'image';

                  return (
                    <div
                      key={item.id}
                      className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#141517] shadow-2xl group transition-all duration-300 hover:border-lime-500/50 hover:shadow-[0_0_25px_rgba(163,230,53,0.15)]"
                    >
                      {/* Aspect Ratio Skeleton Loader / Finished Content */}
                      <div className={cn('w-full relative overflow-hidden bg-black/60', aspectClass)}>
                        {!isSuccess && !isFailed && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-black via-[#1a1e15] to-black flex flex-col items-center justify-center p-6 text-center space-y-3 animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-lime-400/20 border border-lime-400/50 flex items-center justify-center text-lime-400 shadow-lg">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-lime-400 uppercase tracking-wider block">
                                Generating {item.mode}...
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono block">
                                Task ID: {item.taskId}
                              </span>
                            </div>
                          </div>
                        )}

                        {isFailed && (
                          <div className="absolute inset-0 bg-red-950/30 border border-red-500/30 flex flex-col items-center justify-center p-4 text-center space-y-2.5 backdrop-blur-[2px]">
                            <AlertCircle className="w-7 h-7 text-red-400" />
                            <span className="text-xs font-bold text-red-400">Generation Failed</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryCard(item);
                              }}
                              disabled={retryingCardId === item.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-black text-[11px] font-extrabold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {retryingCardId === item.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Retrying...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Retry</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {isSuccess && outputs.length > 0 && (
                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', outputs[0].fileUrl);
                              e.dataTransfer.setData('application/json', JSON.stringify({ url: outputs[0].fileUrl, type: mediaType }));
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="w-full h-full relative cursor-grab active:cursor-grabbing group/media"
                          >
                            {mediaType === 'video' ? (
                              <FlowVideoCard
                                src={outputs[0].fileUrl}
                                alt={item.prompt}
                                onFullscreen={() => setSelectedPreviewMedia({
                                  url: outputs[0].fileUrl,
                                  type: 'video',
                                  prompt: item.prompt,
                                  model: item.model,
                                  ratio: item.ratio
                                })}
                              />
                            ) : (
                              <img
                                src={outputs[0].fileUrl}
                                alt={item.prompt}
                                onClick={() => setSelectedPreviewMedia({
                                  url: outputs[0].fileUrl,
                                  type: 'image',
                                  prompt: item.prompt,
                                  model: item.model,
                                  ratio: item.ratio
                                })}
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              />
                            )}

                            {/* Top Action Buttons Bar */}
                            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              
                              {/* Full Preview Lightbox Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPreviewMedia({
                                    url: outputs[0].fileUrl,
                                    type: mediaType,
                                    prompt: item.prompt,
                                    model: item.model,
                                    ratio: item.ratio
                                  });
                                }}
                                className="p-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white hover:text-lime-400 transition-all shadow-lg"
                                title="Full screen preview"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>

                              {/* Reuse Prompt Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReusePrompt(item);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-xs font-bold text-lime-400 hover:bg-lime-400 hover:text-black transition-all shadow-lg"
                                title="Reuse prompt & settings"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reuse</span>
                              </button>

                              {/* Download Button (In-Place Native Download) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cleanExt = mediaType === 'video' ? 'mp4' : 'png';
                                   const cleanName = `Gaga_Flow_${item.taskId || item.id}.${cleanExt}`;
                                  downloadAsset(outputs[0].fileUrl, cleanName);
                                }}
                                className="p-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white hover:text-lime-400 transition-all shadow-lg"
                                title="Download full resolution"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Bottom Info Overlay Badge */}
                            <div 
                              onClick={() => setSelectedPreviewMedia({
                                url: outputs[0].fileUrl,
                                type: mediaType,
                                prompt: item.prompt,
                                model: item.model,
                                ratio: item.ratio
                              })}
                              className="absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-black via-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end space-y-1.5 cursor-pointer"
                            >
                              {/* Reference Media Thumbnails (Sleek, Compact PiP Badges) */}
                              {item.attachments && item.attachments.length > 0 && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className="text-[9px] text-lime-400 font-mono font-bold uppercase tracking-wider bg-black/70 px-1.5 py-0.5 rounded border border-white/10">
                                    REF
                                  </span>
                                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full custom-scrollbar py-0.5">
                                    {item.attachments.map((att, i) => (
                                      <div 
                                        key={i} 
                                        className="w-8 h-8 rounded-lg overflow-hidden border border-white/30 bg-black/80 flex items-center justify-center flex-shrink-0 shadow-md hover:scale-110 transition-transform relative group/pip"
                                        title={`Reference ${i + 1} (${att.type})`}
                                      >
                                        {att.type === 'video' ? (
                                          <video src={att.url} className="w-full h-full object-cover" muted playsInline />
                                        ) : att.type === 'audio' ? (
                                          <FileAudio className="w-3.5 h-3.5 text-lime-400" />
                                        ) : (
                                          <img src={att.url} alt="ref" className="w-full h-full object-cover" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <p className="text-[11px] text-gray-200 line-clamp-2 font-semibold leading-snug">
                                {item.prompt && !item.prompt.includes('/edit') && !item.prompt.includes('/economy') && !item.prompt.includes('gpt-image-2.0') && !item.prompt.includes('f-2-klein-9b')
                                  ? item.prompt
                                  : 'Commercial Visual Generation'}
                              </p>

                              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 font-extrabold border border-lime-500/30 truncate max-w-[100px]">
                                  {item.model}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono font-bold">
                                  {item.ratio}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono font-bold">
                                  {item.quality}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Docked Control Panel at Bottom (Centered & Responsive) */}
          <div className="sticky bottom-6 z-40 w-full max-w-4xl px-4 mx-auto mt-auto pointer-events-auto">
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'bg-[#1a1c20]/95 border transition-all rounded-3xl p-4 shadow-2xl flex flex-col justify-between backdrop-blur-2xl relative',
                isDragging ? 'border-lime-400 bg-lime-950/30 shadow-[0_0_35px_rgba(163,230,53,0.4)]' : 'border-white/15'
              )}
            >
              {/* Drag & Drop Overlay Indicator */}
              {isDragging && (
                <div className="absolute inset-0 z-50 rounded-3xl bg-black/90 backdrop-blur-md border-2 border-dashed border-lime-400 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <Upload className="w-10 h-10 text-lime-400 animate-bounce" />
                  <span className="text-sm font-bold text-lime-400">Drop files or generated image here to attach</span>
                </div>
              )}

              {/* Media Attachments Slot & Prompt Area */}
              <div className="flex items-start gap-4">
                
                {/* Mode Switcher Buttons inside dock */}
                <div className="flex flex-col gap-1 bg-[#121316] border border-white/10 p-1 rounded-2xl flex-shrink-0">
                  <button
                    onClick={() => {
                      setActiveMode('image');
                      setQuality('1k');
                    }}
                    className={cn(
                      'p-2 rounded-xl transition-all',
                      activeMode === 'image' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40 shadow-sm' : 'text-gray-400 hover:text-white'
                    )}
                    title="AI Image Mode"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveMode('video');
                      setQuality('720p');
                    }}
                    className={cn(
                      'p-2 rounded-xl transition-all',
                      activeMode === 'video' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40 shadow-sm' : 'text-gray-400 hover:text-white'
                    )}
                    title="AI Video Mode"
                  >
                    <Film className="w-4 h-4" />
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                />

                {/* Compact Stacked Media Card Deck (Handles local files + reused attachedUrls) */}
                <div 
                  ref={mediaDeckRef}
                  onClick={() => {
                    if (uploadedFiles.length === 0 && attachedUrls.length === 0) {
                      fileInputRef.current?.click();
                    } else {
                      setShowAssetInspector(prev => !prev);
                    }
                  }}
                  className="relative w-16 h-20 rounded-xl cursor-pointer transition-all flex-shrink-0 group my-auto"
                  title={uploadedFiles.length > 0 || attachedUrls.length > 0 ? `${uploadedFiles.length + attachedUrls.length} media file(s) attached. Click to open asset inspector table, or click + to add more.` : 'Click to add media or drag generated image here'}
                >
                  {uploadedFiles.length === 0 && attachedUrls.length === 0 ? (
                    <div className="w-full h-full rounded-xl border-2 border-dashed border-white/20 hover:border-lime-400/80 bg-black/40 hover:bg-black/60 flex flex-col items-center justify-center transition-all">
                      <Plus className="w-5 h-5 text-gray-500 group-hover:text-lime-400 transition-colors mb-0.5" />
                      <span className="text-[9px] text-gray-500 group-hover:text-gray-300 font-medium">Add Media</span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {[...previewUrls, ...attachedUrls].slice(0, 3).map((item, idx) => {
                        const isTop = idx === 0;
                        const offsetRotate = idx === 0 ? '-6deg' : idx === 1 ? '4deg' : '0deg';
                        const offsetTranslateX = idx === 0 ? '-3px' : idx === 1 ? '3px' : '0px';

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'absolute inset-0 rounded-xl overflow-hidden border border-white/30 bg-black shadow-xl transition-all',
                              isTop ? 'z-10 scale-100 border-white/40' : 'z-0 opacity-80'
                            )}
                            style={{
                              transform: `rotate(${offsetRotate}) translateX(${offsetTranslateX})`,
                            }}
                          >
                            {item.type === 'video' ? (
                              <video 
                                src={item.url} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                loop 
                                playsInline 
                              />
                            ) : item.type === 'audio' ? (
                              <FileAudio className="w-6 h-6 text-lime-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            ) : (
                              <img src={item.url} alt={`stack-${idx}`} className="w-full h-full object-cover" />
                            )}
                          </div>
                        );
                      })}

                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="absolute -bottom-1 -right-1 z-10 w-5 h-5 rounded-full bg-black/90 border border-white/40 flex items-center justify-center text-lime-400 shadow-md group-hover:scale-110 transition-transform cursor-pointer"
                        title="Upload additional files"
                      >
                        <Plus className="w-3 h-3" />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFiles([]);
                          setAttachedUrls([]);
                          setShowAssetInspector(false);
                        }}
                        className="absolute -top-1.5 -left-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                        title="Clear attached media"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}

                  {/* Floating Asset Inspector Popover (Stable Click-to-Toggle UI/UX Inspection) */}
                  {showAssetInspector && (uploadedFiles.length > 0 || attachedUrls.length > 0) && (
                    <div 
                      ref={assetInspectorRef}
                      className="absolute left-0 bottom-full mb-3 z-50 w-80 sm:w-96 bg-[#12141a]/95 border border-white/20 rounded-2xl shadow-2xl p-4 backdrop-blur-2xl text-left animate-in fade-in slide-in-from-bottom-2 duration-150 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                            Attached Assets ({uploadedFiles.length + attachedUrls.length})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedFiles([]);
                              setAttachedUrls([]);
                              setShowAssetInspector(false);
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 font-mono flex items-center gap-1 hover:underline"
                          >
                            <Trash2 className="w-3 h-3" /> Clear All
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAssetInspector(false)}
                            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Close Attached Assets table"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Scrollable list of attached items */}
                      <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                        {/* 1. Local preview files */}
                        {previewUrls.map((p, idx) => (
                          <div key={`local-${idx}`} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-lime-500/30 transition-all">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 flex items-center justify-center">
                              {p.type === 'video' ? (
                                <video src={p.url} className="w-full h-full object-cover" muted playsInline />
                              ) : p.type === 'audio' ? (
                                <FileAudio className="w-6 h-6 text-lime-400" />
                              ) : (
                                <img src={p.url} alt={`preview-${idx}`} className="w-full h-full object-contain" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30">
                                  @{p.type === 'video' ? `Video ${idx + 1}` : p.type === 'audio' ? `Audio ${idx + 1}` : `Image ${idx + 1}`}
                                </span>
                                <span className="text-[9px] text-zinc-400 uppercase font-mono">{p.type}</span>
                              </div>
                              <p className="text-[11px] text-zinc-300 truncate mt-1">
                                {uploadedFiles[idx]?.name || `Attached ${p.type} ${idx + 1}`}
                              </p>
                              {uploadedFiles[idx]?.size && (
                                <p className="text-[9px] text-zinc-500 font-mono">
                                  {(uploadedFiles[idx].size / 1024).toFixed(0)} KB
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...uploadedFiles];
                                newFiles.splice(idx, 1);
                                setUploadedFiles(newFiles);
                                if (newFiles.length === 0 && attachedUrls.length === 0) setShowAssetInspector(false);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                              title="Remove this asset"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {/* 2. Reused attached URLs */}
                        {attachedUrls.map((att, idx) => (
                          <div key={`att-${idx}`} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-lime-500/30 transition-all">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 flex items-center justify-center">
                              {att.type === 'video' ? (
                                <video src={att.url} className="w-full h-full object-cover" muted playsInline />
                              ) : att.type === 'audio' ? (
                                <FileAudio className="w-6 h-6 text-lime-400" />
                              ) : (
                                <img src={att.url} alt={`att-${idx}`} className="w-full h-full object-contain" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30">
                                  @{att.type === 'video' ? `Video ${previewUrls.length + idx + 1}` : `Image ${previewUrls.length + idx + 1}`}
                                </span>
                                <span className="text-[9px] text-zinc-400 uppercase font-mono">Reused {att.type}</span>
                              </div>
                              <p className="text-[11px] text-zinc-300 truncate mt-1">
                                {att.url.split('/').pop() || 'Studio Asset'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newUrls = [...attachedUrls];
                                newUrls.splice(idx, 1);
                                setAttachedUrls(newUrls);
                                if (previewUrls.length === 0 && newUrls.length === 0) setShowAssetInspector(false);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                              title="Remove this asset"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Footer action to add more */}
                      <div className="pt-2.5 mt-2 border-t border-white/10 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-lime-400 hover:text-lime-300 font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add more media
                        </button>
                        <span className="text-[9px] text-zinc-500 font-mono">Type @ in prompt to mention</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Textarea Prompt Field with SaaS-Grade @ Mention Popup */}
                <div className="flex-1 relative flex flex-col justify-center">
                  <div className="relative w-full">
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      rows={1}
                      onChange={e => {
                        const val = e.target.value;
                        const cursorPos = e.target.selectionStart || val.length;
                        setPrompt(val);

                        const textBeforeCursor = val.slice(0, cursorPos);
                        const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

                        if (atMatch && availableMedia.length > 0) {
                          setShowMentionPopup(true);
                          setMentionQuery(atMatch[1] || '');
                          mentionStartIndexRef.current = atMatch.index !== undefined ? atMatch.index : (cursorPos - atMatch[0].length);
                          setActiveMentionIndex(0);
                        } else {
                          setShowMentionPopup(false);
                          setMentionQuery('');
                          mentionStartIndexRef.current = null;
                        }
                      }}
                      onKeyDown={e => {
                        // Keyboard Navigation for Mention Popup
                        if (showMentionPopup && filteredMedia.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveMentionIndex(prev => (prev + 1) % filteredMedia.length);
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveMentionIndex(prev => (prev - 1 + filteredMedia.length) % filteredMedia.length);
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            insertMention(filteredMedia[activeMentionIndex]);
                            return;
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowMentionPopup(false);
                            return;
                          }
                        }

                        if (e.key === 'Enter' && !e.shiftKey && !showMentionPopup) {
                          e.preventDefault();
                          handleGenerate();
                        }
                      }}
                      placeholder="Describe the scene you imagine... (Type @ to mention attached media or drag generated images here)"
                      className="w-full bg-transparent border-none outline-none text-sm text-gray-200 placeholder:text-gray-500 resize-none py-1 pr-8 min-h-[40px] max-h-[160px] overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
                    />

                    {/* Quick Clear Text Button */}
                    {prompt.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt('');
                          if (promptTextareaRef.current) {
                            promptTextareaRef.current.style.height = '40px';
                            promptTextareaRef.current.focus();
                          }
                        }}
                        className="absolute right-0 top-1 text-gray-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        title="Clear prompt"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Possible Mentions Popup (SaaS Floating Menu with Blur Prevention) */}
                  {showMentionPopup && filteredMedia.length > 0 && (
                    <div 
                      ref={mentionPopupRef}
                      className="absolute left-0 bottom-full mb-3 w-64 bg-[#181a1f] border border-white/15 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between px-2 py-1 border-b border-white/5 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Mention Asset
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono">
                          ↑↓ nav • ↵ select
                        </span>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {filteredMedia.map((item, idx) => {
                          const isSelected = idx === activeMentionIndex;
                          return (
                            <button
                              key={item.index}
                              type="button"
                              onMouseDown={(e) => {
                                // CRITICAL: Prevent textarea from losing focus/selection range
                                e.preventDefault();
                              }}
                              onClick={() => insertMention(item)}
                              onMouseEnter={() => setActiveMentionIndex(idx)}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-all group",
                                isSelected 
                                  ? "bg-lime-500/20 text-lime-400 font-bold border border-lime-500/30" 
                                  : "hover:bg-white/5 text-gray-200 border border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                  {item.type.includes('video') ? (
                                    <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                                  ) : item.type.includes('audio') ? (
                                    <FileAudio className="w-4 h-4 text-lime-400" />
                                  ) : (
                                    <img src={item.url} alt="thumb" className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className={cn("font-semibold block truncate", isSelected ? "text-lime-400" : "text-gray-200")}>
                                    @{item.tagLabel}
                                  </span>
                                  <span className="text-[9px] text-gray-500 block uppercase font-mono">
                                    {item.type}
                                  </span>
                                </div>
                              </div>
                              <CheckCircle2 className={cn("w-4 h-4 text-lime-400 transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Controls Bar */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/10 relative z-50">
                <div className="flex items-center gap-3">
                  
                  {/* Model Selector Dropdown */}
                  <div className="relative" ref={modelDropdownRef}>
                    <button
                      onClick={() => { setIsModelOpen(!isModelOpen); setIsRatioOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#24272e] border border-white/10 text-xs font-medium text-gray-200 hover:border-lime-500/40 transition-all max-w-[260px]"
                    >
                      {activeModelObj?.logo ? (
                        <div className="w-4 h-4 rounded bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                          <img src={activeModelObj.logo} alt="" className="w-3.5 h-3.5 object-contain" />
                        </div>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                      )}
                      <span className="truncate text-left font-semibold text-gray-200">
                        {parseModelName(activeModelObj?.name || '').displayName}
                      </span>
                      {parseModelName(activeModelObj?.name || '').badge && (
                        <ModelBadge text={parseModelName(activeModelObj?.name || '').badge!} />
                      )}
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-0.5" />
                    </button>

                    {isModelOpen && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1e2127] border border-white/10 rounded-2xl shadow-2xl p-2 z-[60] space-y-1">
                        {(activeMode === 'image' ? IMAGE_MODELS : VIDEO_MODELS.filter(m => !DISABLED_VIDEO_MODELS.includes(m.id))).map(m => {
                          const { displayName, badge } = parseModelName(m.name);
                          const isSelected = (activeMode === 'image' ? selectedImageModel : selectedVideoModel) === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                if (activeMode === 'image') setSelectedImageModel(m.id);
                                else setSelectedVideoModel(m.id);
                                setIsModelOpen(false);
                              }}
                              className={cn(
                                'w-full text-left p-2 rounded-xl text-xs font-medium transition-all flex items-center gap-3',
                                isSelected
                                  ? 'bg-lime-500/10 text-lime-400 font-bold border border-lime-500/20 shadow-md'
                                  : 'text-gray-300 hover:bg-white/5 border border-transparent'
                              )}
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                {m.logo ? (
                                  <img src={m.logo} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                  <Sparkles className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1.5 min-w-0">
                                  <span className="font-semibold text-gray-200 truncate">{displayName}</span>
                                  {badge && <ModelBadge text={badge} />}
                                </div>
                                {m.stats && (
                                  <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-500 font-semibold">
                                    <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                      <Zap className="w-2.5 h-2.5 text-lime-400" /> {m.stats[0]}
                                    </span>
                                    <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                      <Clock className="w-2.5 h-2.5 text-gray-400" /> {m.stats[1]}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Integrated Graphic Aspect Ratio & Resolution Popover Modal */}
                  <div className="relative" ref={ratioPopoverRef}>
                    <button
                      onClick={() => { setIsRatioOpen(!isRatioOpen); setIsModelOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#24272e] border border-white/10 text-xs font-semibold text-lime-400 hover:border-lime-500/40 transition-all"
                    >
                      <AspectRatioGraphic ratio={ratio} className="w-3.5 h-3.5 text-lime-400" />
                      <span>{ratio} / {quality}{activeMode === 'video' && ` / ${duration}`}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
                    </button>

                    {/* Popover Card Modal */}
                    {isRatioOpen && (
                      <div 
                        onClick={e => e.stopPropagation()}
                        onDragStart={e => e.stopPropagation()}
                        onDragOver={e => e.stopPropagation()}
                        onDragEnter={e => e.stopPropagation()}
                        onDragLeave={e => e.stopPropagation()}
                        onDrop={e => e.stopPropagation()}
                        className="absolute left-0 bottom-full mb-3 w-[340px] bg-[#141517] border border-white/15 rounded-2xl shadow-2xl p-4 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-4"
                      >
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-gray-400 tracking-wide block">Aspect Ratio</span>
                          <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                            {currentAvailableRatios.map(r => {
                              const isSelected = ratio === r;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setRatio(r)}
                                  className={cn(
                                    'flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square gap-1.5',
                                    isSelected
                                      ? 'bg-[#262c1d] border-lime-500/60 text-lime-400 shadow-[0_0_12px_rgba(163,230,53,0.25)] font-bold'
                                      : 'bg-[#1e2127] border-white/5 text-gray-300 hover:border-white/20 hover:bg-white/5'
                                  )}
                                >
                                  <AspectRatioGraphic ratio={r} className={cn('w-5 h-5', isSelected ? 'text-lime-400' : 'text-gray-400')} />
                                  <span className="text-[10px] truncate max-w-full font-mono">{r}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-white/10">
                          <span className="text-xs font-semibold text-gray-400 tracking-wide block">Resolution</span>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-[#0d0e10] p-2 rounded-xl border border-white/5">
                            {currentAvailableResolutions.map(q => {
                              const isSelected = quality === q;
                              return (
                                <button
                                  key={q}
                                  type="button"
                                  onClick={() => setQuality(q)}
                                  className={cn(
                                    'min-w-0 min-h-9 px-2 py-2 text-center rounded-lg text-[10px] leading-tight font-bold transition-all whitespace-normal break-words',
                                    isSelected
                                      ? 'bg-[#24272e] text-white border border-white/15 shadow-md font-extrabold'
                                      : 'text-gray-400 hover:text-gray-200'
                                  )}
                                >
                                  {q}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Video Settings Toggles */}
                        {activeMode === 'video' && (
                          <>
                            {/* Duration — hidden for Gemini video-edit (follows input video) */}
                            {isGeminiVideoEdit ? (
                              <div className="space-y-2 pt-2 border-t border-white/10">
                                <label className="text-xs font-semibold text-gray-400 tracking-wide flex items-center gap-2 uppercase">
                                  <Clock className="w-3.5 h-3.5" /> Video Duration
                                </label>
                                <div className="flex items-center gap-2 bg-[#0d0e10] border border-white/5 rounded-xl px-3 py-2.5">
                                  <span className="text-[11px] text-amber-400 font-semibold">⚡ Auto</span>
                                  <span className="text-[11px] text-gray-500">
                                    {inputVideoDuration
                                      ? `Input: ~${inputVideoDuration}s → output: ${[4,6,8,10].find(d => d >= inputVideoDuration) ?? 10}s`
                                      : 'Output duration auto-set based on input video (max 10s)'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                            <div className="space-y-2 pt-2 border-t border-white/10">
                              <label className="text-xs font-semibold text-gray-400 tracking-wide flex items-center justify-between uppercase">
                                <span className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5" /> Video Duration
                                </span>
                                {currentVideoConfig.durationMode === 'slider' && (
                                  <span className="bg-[#242832] border border-white/10 text-white text-xs px-2 py-0.5 rounded-md font-mono">
                                    {duration.replace(/s$/, '')} s
                                  </span>
                                )}
                              </label>

                              {currentVideoConfig.durationMode === 'slider' ? (
                                <div className="flex items-center gap-3 pt-1">
                                  <input 
                                    type="range" 
                                    min={currentVideoConfig.minDuration || 4} 
                                    max={currentVideoConfig.maxDuration || 15} 
                                    step={1}
                                    value={parseInt(duration.replace(/[^0-9]/g, ''), 10) || 6}
                                    onChange={(e) => setDuration(`${e.target.value}s`)}
                                    className="w-full h-2 bg-[#0d0e10] rounded-lg appearance-none cursor-pointer accent-lime-400"
                                  />
                                </div>
                              ) : (
                                <div 
                                  className="grid gap-2 bg-[#0d0e10] p-1 rounded-xl border border-white/5"
                                  style={{ gridTemplateColumns: `repeat(${currentVideoConfig.durations.length}, minmax(0, 1fr))` }}
                                >
                                  {currentVideoConfig.durations.map(d => {
                                    const isSelected = duration === d;
                                    return (
                                      <button 
                                        key={d}
                                        type="button"
                                        onClick={() => setDuration(d)}
                                        className={cn(
                                          "py-1.5 text-center rounded-lg text-xs font-bold transition-all",
                                          isSelected ? "bg-[#24272e] text-white border border-white/15 shadow-md" : "text-gray-500 hover:text-gray-300"
                                        )}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            )}

                            {/* Real Person & Generate Audio Toggles */}
                            {(currentVideoConfig.supportsRealPerson || currentVideoConfig.supportsAudio) && (
                              <div className="flex gap-4 pt-2 border-t border-white/10">
                                {/* Real Person */}
                                {currentVideoConfig.supportsRealPerson && (
                                  <div className="flex-1 space-y-2">
                                    <span className="text-[11px] font-semibold text-gray-400 block uppercase">Real Person</span>
                                    <div className="grid grid-cols-2 gap-1 bg-[#0d0e10] p-0.5 rounded-lg border border-white/5">
                                      {['On', 'Off'].map(v => (
                                        <button 
                                          key={v}
                                          type="button"
                                          onClick={() => setRealPerson(v)}
                                          className={cn(
                                            "py-1.5 text-center rounded text-[10px] font-bold transition-all",
                                            realPerson === v ? "bg-[#24272e] text-white shadow-sm" : "text-gray-500"
                                          )}
                                        >
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Audio */}
                                {currentVideoConfig.supportsAudio && (
                                  <div className="flex-1 space-y-2">
                                    <span className="text-[11px] font-semibold text-gray-400 block uppercase">Audio</span>
                                    <div className="grid grid-cols-2 gap-1 bg-[#0d0e10] p-0.5 rounded-lg border border-white/5">
                                      {['On', 'Off'].map(v => (
                                        <button 
                                          key={v}
                                          type="button"
                                          onClick={() => setAudio(v)}
                                          className={cn(
                                            "py-1.5 text-center rounded text-[10px] font-bold transition-all",
                                            audio === v ? "bg-[#24272e] text-white shadow-sm" : "text-gray-500"
                                          )}
                                        >
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Batch Generator Count Selector (1x - 4x) — hidden for video while ENABLE_VIDEO_BATCH is false */}
                  {(activeMode !== 'video' || ENABLE_VIDEO_BATCH) && (
                    <div className="flex items-center bg-[#24272e] border border-white/10 p-0.5 rounded-xl text-xs font-bold">
                      {[1, 2, 3, 4].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setBatchCount(count)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg transition-all',
                            batchCount === count ? 'bg-lime-400 text-black shadow-sm font-black' : 'text-gray-400 hover:text-white'
                          )}
                          title={`Generate ${count} result(s) per run`}
                        >
                          {count}x
                        </button>
                      ))}
                    </div>
                  )}

                </div>

                {/* Standalone Generate Action Button */}
                <div className="flex items-center">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="w-9 h-9 rounded-full bg-lime-400 hover:bg-lime-300 text-black flex items-center justify-center shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-105 transition-all disabled:opacity-50"
                    title={activeMode === 'video' && !ENABLE_VIDEO_BATCH ? 'Generate (1x)' : `Generate (${batchCount}x)`}
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-5 h-5 stroke-[2.5]" />}
                  </button>
                </div>

              </div>
            </div>
          </div>

        </main>
      </div>

      {/* ─── Full Preview Lightbox Modal ─────────────────────────────────────── */}
      {selectedPreviewMedia && (
        <div 
          onClick={() => setSelectedPreviewMedia(null)}
          className="fixed inset-0 z-50 bg-[#070708]/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-150"
        >
          {/* Top-Left Floating Zoom Controls Toolbar */}
          <div 
            onClick={e => e.stopPropagation()}
            className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-1.5 bg-[#121316]/90 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setPreviewZoom(z => {
                  const next = Math.max(1, Math.round((z - 0.25) * 100) / 100);
                  if (next <= 1) setPreviewPan({ x: 0, y: 0 });
                  return next;
                });
              }}
              disabled={previewZoom <= 1}
              className="p-1.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono font-bold text-lime-400 min-w-[48px] text-center px-1">
              {Math.round(previewZoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() => {
                setPreviewZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100));
              }}
              disabled={previewZoom >= 4}
              className="p-1.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {previewZoom !== 1 && (
              <button
                type="button"
                onClick={() => {
                  setPreviewZoom(1);
                  setPreviewPan({ x: 0, y: 0 });
                }}
                className="ml-1 px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-mono font-bold text-gray-300 hover:text-white transition-colors"
                title="Reset zoom to 100%"
              >
                Reset
              </button>
            )}
          </div>

          {/* Header Action Buttons */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const matched = canvasItems.find(i => i.outputs?.some(o => o.fileUrl === selectedPreviewMedia.url) || i.taskId === (selectedPreviewMedia as any).taskId);
                if (matched) {
                  handleReusePrompt(matched);
                } else {
                  const rawPrompt = (selectedPreviewMedia.prompt || '').trim();
                  const isTechnicalRoute = 
                    rawPrompt.includes('/edit') || 
                    rawPrompt.includes('/economy') || 
                    rawPrompt.includes('gpt-image-2.0') || 
                    rawPrompt.includes('f-2-klein-9b') ||
                    rawPrompt.toLowerCase() === 'generation' ||
                    rawPrompt.toLowerCase() === 'standard';

                  setPrompt(isTechnicalRoute ? '' : rawPrompt);
                  if (selectedPreviewMedia.ratio) setRatio(selectedPreviewMedia.ratio);
                  if (selectedPreviewMedia.model) {
                    if (selectedPreviewMedia.type === 'video') {
                      setActiveMode('video');
                      setSelectedVideoModel(resolveVideoModelId(selectedPreviewMedia.model));
                    } else {
                      setActiveMode('image');
                      setSelectedImageModel(resolveImageModelId(selectedPreviewMedia.model));
                    }
                  }
                  // Restore this high-res previewed media into Add Media!
                  setUploadedFiles([]);
                  setAttachedUrls([{ url: selectedPreviewMedia.url, type: selectedPreviewMedia.type }]);
                  toast.success('Restored prompt, reference media & settings from preview!');
                }
                setSelectedPreviewMedia(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black/80 border border-white/20 text-lime-400 hover:bg-lime-400 hover:text-black text-xs font-extrabold transition-all shadow-lg"
              title="Reuse prompt & settings"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reuse Settings</span>
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                const cleanExt = selectedPreviewMedia.type === 'video' ? 'mp4' : 'png';
                const cleanName = `Gaga_HighRes_${Date.now()}.${cleanExt}`;
                downloadAsset(selectedPreviewMedia.url, cleanName);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-lime-400 text-black hover:bg-lime-300 text-xs font-extrabold transition-all shadow-[0_0_20px_rgba(163,230,53,0.4)]"
            >
              <Download className="w-4 h-4" />
              <span>Download High-Res</span>
            </button>
            <button
              onClick={() => setSelectedPreviewMedia(null)}
              className="p-2.5 rounded-full bg-black/80 hover:bg-red-500/20 border border-white/20 hover:border-red-500/40 text-gray-300 hover:text-red-400 transition-all shadow-xl"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center High-Res Media Container with Pan/Zoom Canvas */}
          <div 
            ref={previewViewportRef}
            onMouseDown={handlePreviewMouseDown}
            onClick={e => e.stopPropagation()}
            className={cn(
              "max-w-5xl max-h-[82vh] w-full flex flex-col items-center justify-center relative my-auto select-none space-y-4",
              previewZoom > 1 ? (isPanningPreview ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
            style={{
              overscrollBehavior: 'contain',
              touchAction: 'none',
            }}
          >
            <div className="relative overflow-hidden rounded-3xl max-w-full max-h-[75vh] flex items-center justify-center">
              {selectedPreviewMedia.type === 'video' ? (
                <video
                  src={selectedPreviewMedia.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  className="max-w-full max-h-[75vh] rounded-3xl shadow-2xl border border-white/15 object-contain will-change-transform"
                  style={{
                    transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    transition: isPanningPreview ? 'none' : 'transform 0.15s ease-out',
                  }}
                />
              ) : (
                <img
                  src={selectedPreviewMedia.url}
                  alt="Full Preview"
                  className="max-w-full max-h-[75vh] rounded-3xl shadow-2xl border border-white/15 object-contain will-change-transform"
                  style={{
                    transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    transition: isPanningPreview ? 'none' : 'transform 0.15s ease-out',
                  }}
                  draggable={false}
                />
              )}
            </div>

            {/* Prompt & Meta Details Footer */}
            {selectedPreviewMedia.prompt && !selectedPreviewMedia.prompt.includes('/edit') && !selectedPreviewMedia.prompt.includes('/economy') && !selectedPreviewMedia.prompt.includes('gpt-image-2.0') && !selectedPreviewMedia.prompt.includes('f-2-klein-9b') && (
              <div className="px-6 py-3 rounded-2xl bg-[#141517]/90 border border-white/15 text-center max-w-2xl backdrop-blur-sm shadow-2xl space-y-1">
                <p className="text-xs sm:text-sm text-gray-200 font-medium line-clamp-2">
                  "{selectedPreviewMedia.prompt}"
                </p>
                <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-gray-400 font-mono">
                  {selectedPreviewMedia.model && (
                    <span className="text-lime-400 font-bold">{selectedPreviewMedia.model}</span>
                  )}
                  {selectedPreviewMedia.ratio && (
                    <span>• {selectedPreviewMedia.ratio}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CREATE PROJECT MODAL ─── */}
      {isCreateProjectModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsCreateProjectModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-[#141518] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Flow Project</h3>
                  <span className="text-[11px] text-zinc-400 font-mono">Organize visual assets into isolated campaigns</span>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateProjectModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block">
                  Project Name <span className="text-lime-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="e.g. Summer Perfume Campaign 2026"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0c0d0f] border border-white/10 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-lime-400 transition-colors"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateProject();
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block">
                  Description <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  placeholder="e.g. Commercial visuals and video promos for luxury fragrance line"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0c0d0f] border border-white/10 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-lime-400 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsCreateProjectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                className="px-5 py-2 rounded-xl bg-lime-400 text-black font-extrabold text-xs hover:bg-lime-300 transition-all shadow-lg shadow-lime-400/20 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RENAME PROJECT MODAL ─── */}
      {isRenameProjectModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsRenameProjectModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-[#141518] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Rename Flow Project</h3>
                  <span className="text-[11px] text-zinc-400 font-mono">Update project title</span>
                </div>
              </div>
              <button 
                onClick={() => setIsRenameProjectModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block">
                  Project Name <span className="text-lime-400">*</span>
                </label>
                <input
                  type="text"
                  value={renameProjectName}
                  onChange={e => setRenameProjectName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0c0d0f] border border-white/10 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-lime-400 transition-colors"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameProject();
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsRenameProjectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameProject}
                className="px-5 py-2 rounded-xl bg-lime-400 text-black font-extrabold text-xs hover:bg-lime-300 transition-all shadow-lg shadow-lime-400/20 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickCreatePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-black text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin text-lime-400" />
      </div>
    }>
      <GagaAuthGate>{() => <QuickCreateContent />}</GagaAuthGate>
    </Suspense>
  );
}
