// Custom wallpaper images. Downscaled and re-encoded before storing, so a
// phone photo fits comfortably in chrome.storage.local (10 MB quota).

const MAX_SIDE = 1600;

/** A wallpaper file as a JPEG data URL, longest side at most 1600px. */
export async function wallpaperFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file.');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** Opens the file picker; resolves null when cancelled. */
export function pickWallpaper(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      wallpaperFromFile(file).then(resolve, reject);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export const chatWallKey = (chat: string) => `chat:${chat}`;
