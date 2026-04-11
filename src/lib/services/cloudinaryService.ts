/**
 * Cloudinary Service for client-side video uploads
 */
export const cloudinaryService = {
  /**
   * Upload video to Cloudinary using Unsigned Presets
   */
  async uploadVideo(
    file: File,
    onProgress?: (progress: number) => void,
    abortController?: AbortController
  ) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary credentials missing in .env.local");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    
    // Obfuscate naming: Cloudinary will generate a random public_id if not specified, 
    // or we can specify one. We'll let Cloudinary handle the randomness for security.
    formData.append("folder", "ai4autism_videos");

    return new Promise<{ url: string; publicId: string; secureUrl: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

      if (abortController) {
        abortController.signal.addEventListener("abort", () => {
          xhr.abort();
          reject(new Error("Upload canceled"));
        });
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.url,
            publicId: response.public_id,
            secureUrl: response.secure_url,
          });
        } else {
          reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during Cloudinary upload"));
      xhr.send(formData);
    });
  },

  /**
   * Simple obfuscation for the URL to prevent casual inspection in Firestore
   * (As requested by user "mã hóa link cloudi cho phù hợp")
   */
  obfuscateUrl(url: string) {
    try {
      return btoa(url); // Base64 encoding
    } catch (e) {
      return url;
    }
  },

  deobfuscateUrl(obfuscatedUrl: string) {
    try {
      return atob(obfuscatedUrl);
    } catch (e) {
      return obfuscatedUrl;
    }
  }
};
