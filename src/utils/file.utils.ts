/**
 * File Utility Functions
 * Helper functions for file operations, validation, and formatting
 */

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  extension: string;
}

/**
 * Get file type category from MIME type
 */
export function getFileType(
  mimeType: string
): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSize: number
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(
        maxSize
      )}`,
    };
  }
  return { valid: true };
}

/**
 * Validate file type
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  const isValid = allowedTypes.some((type) => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1));
    }
    return file.type === type;
  });

  if (!isValid) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Get file icon based on type
 */
export function getFileIcon(mimeType: string): string {
  const type = getFileType(mimeType);
  switch (type) {
    case 'image':
      return 'pi pi-image';
    case 'video':
      return 'pi pi-video';
    case 'audio':
      return 'pi pi-volume-up';
    default:
      return 'pi pi-file';
  }
}

/**
 * Get file info from File object
 */
export function getFileInfo(file: File): FileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    extension: getFileExtension(file.name),
  };
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Create file message content
 */
export function createFileMessageContent(
  fileName: string,
  fileSize: number,
  fileType: 'image' | 'video' | 'audio' | 'document'
): string {
  // Return just the filename. The UI will handle showing the file type icon and size
  // in the attachment view or chat list.
  return fileName;
}
