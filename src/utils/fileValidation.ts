// Supported formats and their compatibility info
export const SUPPORTED_VIDEO_TYPES: Record<string, { label: string; compatible: 'full' | 'partial' }> = {
    'video/mp4': { label: 'MP4', compatible: 'full' },
    'video/quicktime': { label: 'MOV', compatible: 'full' },
    'video/webm': { label: 'WebM', compatible: 'full' },
    'video/x-matroska': { label: 'MKV', compatible: 'full' },
    'video/x-msvideo': { label: 'AVI', compatible: 'full' },
    'video/x-flv': { label: 'FLV', compatible: 'full' },
    'video/x-ms-wmv': { label: 'WMV', compatible: 'full' },
    'video/x-m4v': { label: 'M4V', compatible: 'full' },
    'video/3gpp': { label: '3GP', compatible: 'full' },
    'video/3gpp2': { label: '3G2', compatible: 'full' },
    'video/ogg': { label: 'OGV', compatible: 'full' },
    'video/mp2t': { label: 'TS/MTS', compatible: 'full' },
    'video/mpeg': { label: 'MPEG', compatible: 'full' },
    'video/hevc': { label: 'HEVC', compatible: 'full' },
    'video/x-ms-asf': { label: 'ASF', compatible: 'partial' },
    'video/divx': { label: 'DIVX', compatible: 'partial' },
};

export const SUPPORTED_AUDIO_TYPES: Record<string, { label: string; compatible: 'full' | 'partial' }> = {
    'audio/mpeg': { label: 'MP3', compatible: 'full' },
    'audio/mp3': { label: 'MP3', compatible: 'full' },
    'audio/wav': { label: 'WAV', compatible: 'full' },
    'audio/x-wav': { label: 'WAV', compatible: 'full' },
    'audio/wave': { label: 'WAV', compatible: 'full' },
    'audio/flac': { label: 'FLAC', compatible: 'full' },
    'audio/x-flac': { label: 'FLAC', compatible: 'full' },
    'audio/aac': { label: 'AAC', compatible: 'full' },
    'audio/x-aac': { label: 'AAC', compatible: 'full' },
    'audio/ogg': { label: 'OGG', compatible: 'full' },
    'audio/opus': { label: 'OPUS', compatible: 'full' },
    'audio/mp4': { label: 'M4A', compatible: 'full' },
    'audio/x-m4a': { label: 'M4A', compatible: 'full' },
    'audio/m4a': { label: 'M4A', compatible: 'full' },
    'audio/x-ms-wma': { label: 'WMA', compatible: 'full' },
    'audio/aiff': { label: 'AIFF', compatible: 'full' },
    'audio/x-aiff': { label: 'AIFF', compatible: 'full' },
    'audio/amr': { label: 'AMR', compatible: 'full' },
    'audio/3gpp': { label: '3GP Audio', compatible: 'full' },
    'audio/webm': { label: 'WebM Audio', compatible: 'full' },
    'audio/x-caf': { label: 'CAF', compatible: 'partial' },
};

// Extension fallbacks (when MIME is generic like application/octet-stream)
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv', '.m4v', '.3gp', '.3g2', '.ogv', '.ts', '.mts', '.m2ts', '.mpeg', '.mpg', '.hevc', '.h264', '.h265', '.asf', '.divx'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.opus', '.m4a', '.wma', '.aiff', '.aif', '.amr', '.3gp', '.webm', '.caf'];

export type FileCategory = 'video' | 'audio' | 'unsupported';

export interface FileAnalysis {
    category: FileCategory;
    formatLabel: string;
    sizeMB: number;
    sizeFormatted: string;
    mimeType: string;
    extension: string;
    compatible: 'full' | 'partial' | 'unknown';
    warning: string | null;
    error: string | null;
}

export function analyzeFile(file: File, expectedCategory: 'video' | 'audio'): FileAnalysis {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const mime = file.type.toLowerCase() || '';
    const sizeMB = file.size / (1024 * 1024);
    const sizeFormatted = sizeMB >= 1024
        ? `${(sizeMB / 1024).toFixed(2)} GB`
        : `${sizeMB.toFixed(1)} MB`;

    let category: FileCategory = 'unsupported';
    let formatLabel = ext.replace('.', '').toUpperCase() || 'Unknown';
    let compatible: 'full' | 'partial' | 'unknown' = 'unknown';
    let warning: string | null = null;
    let error: string | null = null;

    if (expectedCategory === 'video') {
        const mimeMatch = SUPPORTED_VIDEO_TYPES[mime];
        const extMatch = VIDEO_EXTENSIONS.includes(ext);

        if (mimeMatch) {
            category = 'video';
            formatLabel = mimeMatch.label;
            compatible = mimeMatch.compatible;
        } else if (extMatch) {
            category = 'video';
            compatible = 'full';
        } else if (mime.startsWith('video/')) {
            category = 'video';
            compatible = 'partial';
            warning = `Format "${formatLabel}" is not in the standard list but will be attempted.`;
        } else if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.includes(ext)) {
            category = 'unsupported';
            error = `This is an audio file. Please use the Audio Record section to upload audio files.`;
        } else {
            category = 'unsupported';
            error = `"${formatLabel}" is not a supported video format. Use MP4, MOV, MKV, WebM, AVI, or other video formats.`;
        }
    } else {
        const mimeMatch = SUPPORTED_AUDIO_TYPES[mime];
        const extMatch = AUDIO_EXTENSIONS.includes(ext);

        if (mimeMatch) {
            category = 'audio';
            formatLabel = mimeMatch.label;
            compatible = mimeMatch.compatible;
        } else if (extMatch) {
            category = 'audio';
            compatible = 'full';
        } else if (mime.startsWith('audio/')) {
            category = 'audio';
            compatible = 'partial';
            warning = `Format "${formatLabel}" is not in the standard list but will be attempted.`;
        } else if (mime.startsWith('video/') || VIDEO_EXTENSIONS.includes(ext)) {
            category = 'unsupported';
            error = `This is a video file. Please use the Video Lectures section to upload video files.`;
        } else {
            category = 'unsupported';
            error = `"${formatLabel}" is not a supported audio format. Use MP3, WAV, FLAC, AAC, OGG, M4A, or other audio formats.`;
        }
    }

    // Size warnings
    if (!error) {
        if (expectedCategory === 'video' && sizeMB > 1900) {
            error = `File is ${sizeFormatted}. Maximum allowed size is 2 GB. Please compress the video before uploading.`;
        } else if (expectedCategory === 'audio' && sizeMB > 490) {
            error = `File is ${sizeFormatted}. Maximum allowed size is 500 MB for audio files.`;
        } else if (expectedCategory === 'video' && sizeMB > 800 && !warning) {
            warning = `Large file (${sizeFormatted}). Upload may take a while depending on your connection.`;
        } else if (expectedCategory === 'video' && sizeMB > 400 && !warning) {
            warning = `File is ${sizeFormatted}. Upload will take a few minutes.`;
        }
    }

    return {
        category,
        formatLabel,
        sizeMB,
        sizeFormatted,
        mimeType: mime || 'unknown',
        extension: ext,
        compatible,
        warning,
        error,
    };
}

export function formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
}
