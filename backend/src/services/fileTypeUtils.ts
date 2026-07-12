/**
 * File Type Detection and Metadata Utilities
 * Supports all common file types with proper icons and preview capabilities
 */

export interface FileTypeInfo {
  category: 'image' | 'video' | 'audio' | 'document' | 'pdf' | 'spreadsheet' | 'presentation' | 'archive' | 'text' | 'code' | 'other';
  icon: string;
  canPreview: boolean;
  previewType: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none';
  color: string;
}

const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
  // Images
  'png': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'jpg': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'jpeg': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'gif': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'webp': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'svg': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'bmp': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },
  'ico': { category: 'image', icon: 'Image', canPreview: true, previewType: 'image', color: '#10b981' },

  // Videos
  'mp4': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'mov': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'avi': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'mkv': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'webm': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'flv': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'wmv': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'mpg': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },
  'mpeg': { category: 'video', icon: 'FileVideo', canPreview: true, previewType: 'video', color: '#8b5cf6' },

  // Audio
  'mp3': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },
  'wav': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },
  'aac': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },
  'm4a': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },
  'ogg': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },
  'flac': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },
  'wma': { category: 'audio', icon: 'FileAudio', canPreview: true, previewType: 'audio', color: '#f59e0b' },

  // PDFs
  'pdf': { category: 'pdf', icon: 'FileText', canPreview: true, previewType: 'pdf', color: '#ef4444' },

  // Documents
  'doc': { category: 'document', icon: 'FileText', canPreview: false, previewType: 'none', color: '#3b82f6' },
  'docx': { category: 'document', icon: 'FileText', canPreview: false, previewType: 'none', color: '#3b82f6' },
  'odt': { category: 'document', icon: 'FileText', canPreview: false, previewType: 'none', color: '#3b82f6' },
  'rtf': { category: 'document', icon: 'FileText', canPreview: false, previewType: 'none', color: '#3b82f6' },

  // Spreadsheets
  'xls': { category: 'spreadsheet', icon: 'FileSpreadsheet', canPreview: false, previewType: 'none', color: '#059669' },
  'xlsx': { category: 'spreadsheet', icon: 'FileSpreadsheet', canPreview: false, previewType: 'none', color: '#059669' },
  'ods': { category: 'spreadsheet', icon: 'FileSpreadsheet', canPreview: false, previewType: 'none', color: '#059669' },
  'csv': { category: 'spreadsheet', icon: 'FileSpreadsheet', canPreview: true, previewType: 'text', color: '#059669' },

  // Presentations
  'ppt': { category: 'presentation', icon: 'Presentation', canPreview: false, previewType: 'none', color: '#dc2626' },
  'pptx': { category: 'presentation', icon: 'Presentation', canPreview: false, previewType: 'none', color: '#dc2626' },
  'odp': { category: 'presentation', icon: 'Presentation', canPreview: false, previewType: 'none', color: '#dc2626' },

  // Archives
  'zip': { category: 'archive', icon: 'FileArchive', canPreview: false, previewType: 'none', color: '#6366f1' },
  'rar': { category: 'archive', icon: 'FileArchive', canPreview: false, previewType: 'none', color: '#6366f1' },
  '7z': { category: 'archive', icon: 'FileArchive', canPreview: false, previewType: 'none', color: '#6366f1' },
  'tar': { category: 'archive', icon: 'FileArchive', canPreview: false, previewType: 'none', color: '#6366f1' },
  'gz': { category: 'archive', icon: 'FileArchive', canPreview: false, previewType: 'none', color: '#6366f1' },

  // Text files
  'txt': { category: 'text', icon: 'FileText', canPreview: true, previewType: 'text', color: '#64748b' },
  'md': { category: 'text', icon: 'FileText', canPreview: true, previewType: 'text', color: '#64748b' },
  'log': { category: 'text', icon: 'FileText', canPreview: true, previewType: 'text', color: '#64748b' },

  // Code files
  'js': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'ts': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'jsx': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'tsx': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'json': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'xml': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'html': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'css': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'py': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'java': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'cpp': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'c': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'sh': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'yml': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
  'yaml': { category: 'code', icon: 'FileCode', canPreview: true, previewType: 'text', color: '#eab308' },
};

export function getFileTypeInfo(filename: string): FileTypeInfo {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPE_MAP[ext] || {
    category: 'other',
    icon: 'FileText',
    canPreview: false,
    previewType: 'none',
    color: '#94a3b8'
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',

    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',

    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',

    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv': 'text/csv',
    'txt': 'text/plain',

    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',

    // Code
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

export function isImageFile(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.category === 'image';
}

export function isVideoFile(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.category === 'video';
}

export function isAudioFile(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.category === 'audio';
}

export function isPDFFile(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.category === 'pdf';
}

export function canPreviewInBrowser(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.canPreview;
}
