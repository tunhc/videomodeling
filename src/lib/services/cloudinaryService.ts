/**
 * Cloudinary Service for client-side video uploads
 */
export const cloudinaryService = {
  /**
   * Upload video to Cloudinary using Unsigned Presets
   */
  async uploadVideo(
    file: File,
    metadata: { childId: string; centerName: string; role?: string },
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
    
    // Dynamic folder structure and tagging based on child info
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 12);
    const role = metadata.role || "unknown";
    
    formData.append("folder", `AI4Autism/${metadata.centerName}/Children/${metadata.childId}`);
    formData.append("public_id", `${role}_${metadata.childId}_${timestamp}`);
    formData.append("tags", `${metadata.childId},${metadata.centerName}${metadata.role ? ',' + metadata.role : ''},vst-auto-upload`);

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
   * Apply Cloudinary optimization parameters (f_auto, q_auto) to the URL
   */
  optimizeUrl(url: string) {
    if (!url || !url.includes("cloudinary.com")) return url;
    
    // Check if already optimized or contains transformations
    if (url.includes("/f_auto,q_auto/")) return url;
    
    // Standard format: .../upload/v12345/public_id
    // Target format: .../upload/f_auto,q_auto/v12345/public_id
    return url.replace("/upload/", "/upload/f_auto,q_auto/");
  },

  /**
   * Simple obfuscation for the URL to prevent casual inspection in Firestore
   * (As requested by user "mã hóa link cloudi cho phù hợp")
   */
  obfuscateUrl(url: string) {
    try {
      return btoa(url); // Base64 encoding
    } catch {
      return url;
    }
  },

  deobfuscateUrl(obfuscatedUrl: string) {
    try {
      return atob(obfuscatedUrl);
    } catch {
      return obfuscatedUrl;
    }
  },

  /**
   * Extract the public_id from a Cloudinary URL to use as a display title
   * Example: .../folder/parent_KBC-HCM_Long_B01_2026041310.mp4 -> parent_KBC-HCM_Long_B01_2026041310
   */
  extractPublicIdFromUrl(url: string) {
    if (!url) return "Video";
    try {
      const parts = url.split("/");
      const filenameWithExt = parts[parts.length - 1];
      return filenameWithExt.split(".")[0] || "Video";
    } catch {
      return "Video";
    }
  }
};

