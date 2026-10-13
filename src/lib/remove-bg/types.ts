export type RemoveBgModelId = 'matting-standard';

export interface RemoveBgModelConfig {
  id: RemoveBgModelId;
  name: string;
  badge: 'RECOMMENDED';
  appId: string;
}

export const REMOVE_BG_MODELS: RemoveBgModelConfig[] = [
  {
    id: 'matting-standard',
    name: 'Gaga Precision Matting',
    badge: 'RECOMMENDED',
    appId: '2076728877666717698',
  },
];

export interface RemoveBgVersion {
  versionNumber: number; // 1, 2, 3...
  taskId: string;
  outputUrl: string;
  modelId: RemoveBgModelId;
  modelName: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  error?: string;
  createdAt: string;
}

export interface RemoveBgItem {
  id: string;
  name: string;
  originalUrl: string; // Stored ONCE, reused across all versions
  originalWidth?: number;
  originalHeight?: number;
  versions: RemoveBgVersion[];
  activeVersionIndex: number; // currently viewed version index in before/after slider (0-based)
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface RemoveBgProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  defaultModel: RemoveBgModelId;
  items: RemoveBgItem[];
  createdAt: string;
  updatedAt: string;
}
