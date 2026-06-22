import { api } from '@/services/api.client';

export const mediaService = {
  // Get a presigned URL for direct R2 upload
  getUploadUrl: (content_type: string, file_size: number, media_type: 'image' | 'video') =>
    api.post('/api/media/upload-url', { content_type, file_size, media_type }),

  // Upload file directly to R2 using presigned URL
  uploadToR2: async (presignedUrl: string, file: File): Promise<void> => {
    const res = await fetch(presignedUrl, {
      method:  'PUT',
      body:    file,
      headers: { 'Content-Type': file.type },
    });
    if (!res.ok) throw new Error('Upload to R2 failed');
  },

  // Full flow: get presigned URL → upload → return public URL
  uploadMedia: async (
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<{ public_url: string; key: string; is_video: boolean }> => {
    const media_type = file.type.startsWith('video/') ? 'video' : 'image';

    const { data } = await mediaService.getUploadUrl(file.type, file.size, media_type);
    const { upload_url, public_url, key, is_video } = data.data;

    // Upload with XMLHttpRequest for progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', upload_url);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload  = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });

    return { public_url, key, is_video };
  },
};
