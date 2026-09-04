// Client-only image-upload-to-base64 helper for Feature Sheets (builder
// logos, persisted; hero photos, local-only). No prior art in this app for
// user-uploaded images — Insta Review's are static files — so this is a new
// pattern, kept deliberately simple and consistent with the app's "no blob
// storage, everything in Redis" approach: downscale first so a Redis hash
// field (builder logos) or component state (hero photos) never balloons.

/**
 * Reads an image file, downscales it so its longest side is at most
 * `maxDim` pixels (skipping the redraw if it's already smaller), and
 * resolves to a PNG data URL.
 */
export function fileToDataUrl(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
