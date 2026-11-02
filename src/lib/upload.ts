import { api } from './api';

/** Resize + re-encode as JPEG with high resolution (Full HD 1920px, 90% quality) so photos remain crystal clear/HD while staying reasonably sized. */
export function compressImage(file: File, maxSize = 1920, quality = 0.9): Promise<{ base64: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return reject(new Error('Canvas tidak tersedia'));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ base64: canvas.toDataURL('image/jpeg', quality).split(',')[1], contentType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File bukan gambar yang valid')); };
    img.src = url;
  });
}

/** Uploads an image to the server (stored in the database) and returns its public URL. */
export async function uploadImage(file: File, opts?: { maxSize?: number }): Promise<string> {
  const { base64, contentType } = await compressImage(file, opts?.maxSize);
  const res = await api.post('/api/upload', { contentType, data: base64 });
  if (!res?.url) throw new Error('Upload gagal');
  return res.url as string;
}
