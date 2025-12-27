import {
  Component,
  inject,
  signal,
  EventEmitter,
  Output,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../core/services/chat/chat.service';

export interface FileUploadResult {
  file: File;
  url: string;
  type: 'image' | 'document' | 'video' | 'audio';
  size: number;
  name: string;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class FileUploadComponent implements AfterViewInit {
  private chatService = inject(ChatService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @Input() maxFileSize = 10 * 1024 * 1024; // 10MB default
  @Input() allowedTypes = [
    'image/*',
    'application/pdf',
    'text/*',
    'video/*',
    'audio/*',
  ];
  @Input() multiple = false;
  @Input() receiverId?: string;
  @Input() groupId?: string;
  @Output() fileUploaded = new EventEmitter<FileUploadResult>();
  @Output() uploadError = new EventEmitter<string>();
  @Output() uploadProgress = new EventEmitter<number>();

  isUploading = signal(false);
  dragOver = signal(false);
  selectedFiles = signal<File[]>([]);
  uploadProgressValue = signal(0);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  ngAfterViewInit() {}

  triggerFileInput() {
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.click();
    }
  }

  private handleFiles(files: File[]) {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      // Check if file already exists
      const existingFile = this.selectedFiles().find(
        (f) => f.name === file.name && f.size === file.size
      );
      if (existingFile) {
        errors.push(`${file.name}: File already selected`);
        return;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        errors.push(
          `${file.name} is too large. Maximum size is ${this.formatFileSize(
            this.maxFileSize
          )}`
        );
        return;
      }

      // Check file type
      const isValidType = this.allowedTypes.some((type) => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });

      if (!isValidType) {
        errors.push(`${file.name} is not a supported file type`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      this.uploadError.emit(errors.join(', '));
    }

    if (validFiles.length > 0) {
      // Add new files to existing selection instead of replacing
      const currentFiles = this.selectedFiles();
      this.selectedFiles.set([...currentFiles, ...validFiles]);

      if (!this.multiple && validFiles.length === 1) {
        this.uploadFile(validFiles[0]);
      }
    }
  }

  async uploadFile(file: File) {
    // Prevent multiple uploads of the same file
    if (this.isUploading()) {
      return;
    }

    this.isUploading.set(true);
    this.uploadProgressValue.set(0);

    try {
      // Use real-time file upload through socket service
      const uploadObservable = this.chatService.uploadFile(
        file,
        this.receiverId,
        this.groupId
      );

      uploadObservable.subscribe({
        next: (result) => {
          if (result.type === 'progress') {
            this.uploadProgressValue.set(result.progress);
            this.uploadProgress.emit(result.progress);
          } else if (result.type === 'complete') {
            this.uploadProgressValue.set(100);
            this.uploadProgress.emit(100);

            const fileResult: FileUploadResult = {
              file,
              url: result.result.fileUrl || URL.createObjectURL(file),
              type: this.getFileType(file.type),
              size: file.size,
              name: file.name,
            };

            this.fileUploaded.emit(fileResult);

            // Remove the uploaded file from selection
            const remainingFiles = this.selectedFiles().filter(
              (f) => f !== file
            );
            this.selectedFiles.set(remainingFiles);

            // Reset upload state after successful upload
            this.isUploading.set(false);
            this.uploadProgressValue.set(0);
          }
        },
        error: (error) => {
          this.uploadError.emit(error.message || 'Upload failed');
          this.isUploading.set(false);
          this.uploadProgressValue.set(0);
        },
        complete: () => {
          // Don't reset here as it might interfere with the next upload
        },
      });
    } catch (error: any) {
      this.uploadError.emit(error.message || 'Upload failed');
      this.isUploading.set(false);
      this.uploadProgressValue.set(0);
    }
  }

  uploadSelectedFiles() {
    const files = this.selectedFiles();
    if (files.length > 0) {
      files.forEach((file) => this.uploadFile(file));
    }
  }

  removeFile(file: File) {
    const files = this.selectedFiles().filter((f) => f !== file);
    this.selectedFiles.set(files);
  }

  clearFiles() {
    this.selectedFiles.set([]);
  }

  uploadAllFiles() {
    const files = this.selectedFiles();
    if (files.length === 0) return;

    // Reset upload state
    this.isUploading.set(false);
    this.uploadProgressValue.set(0);

    // Upload files one by one
    files.forEach((file, index) => {
      setTimeout(() => {
        this.uploadFile(file);
      }, index * 200); // Increased delay between uploads
    });
  }

  getFileSize(file: File): string {
    return this.formatFileSize(file.size);
  }

  private getFileType(
    mimeType: string
  ): 'image' | 'document' | 'video' | 'audio' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(file: File): string {
    const type = this.getFileType(file.type);
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
}
