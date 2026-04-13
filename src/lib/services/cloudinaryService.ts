/**
 * Cloudinary Service for client-side video uploads
 */
export const cloudinaryService = {
  /**
   * Upload video to Cloudinary using Unsigned Presets
   */
  async uploadVideo(
    file: File,
    metadata: { childId: string; centerName: string; role?: string; location?: string; index?: number },
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
    
    // Format: Role_ChildID_Location_MMDDYYYY
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${mm}${dd}${yyyy}`;
    
    const roleCapitalized = metadata.role ? metadata.role.charAt(0).toUpperCase() + metadata.role.slice(1).toLowerCase() : "Unknown";
    const childIdClean = metadata.childId.replace(/_/g, '-');
    const centerNameClean = metadata.centerName.replace(/_/g, '-');
    const locationSlug = metadata.location || "unspecified";
    const indexStr = metadata.index !== undefined ? `-${String(metadata.index).padStart(2, '0')}` : "";

    formData.append("folder", `AI4Autism/${centerNameClean}/Children/${childIdClean}`);
    formData.append("public_id", `${roleCapitalized}_${childIdClean}_${locationSlug}-${dateStr}${indexStr}`);
    formData.append("tags", `${childIdClean},${centerNameClean},${roleCapitalized},vst-auto-upload`);

    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const totalSize = file.size;
    const uniqueUploadId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    let start = 0;
    let lastResponse: any = null;

    while (start < totalSize) {
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = file.slice(start, end);
      
      const chunkFormData = new FormData();
      // Copy metadata once (usually only need preset for subsequent chunks, but safe to include)
      chunkFormData.append("file", chunk);
      chunkFormData.append("upload_preset", uploadPreset);
      chunkFormData.append("folder", `AI4Autism/${centerNameClean}/Children/${childIdClean}`);
      chunkFormData.append("public_id", `${roleCapitalized}_${childIdClean}_${locationSlug}-${dateStr}${indexStr}`);
      chunkFormData.append("tags", `${childIdClean},${centerNameClean},${roleCapitalized},vst-auto-upload`);

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
        
        xhr.setRequestHeader("X-Unique-Upload-Id", uniqueUploadId);
        xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${totalSize}`);

        if (abortController) {
          abortController.signal.addEventListener("abort", () => {
            xhr.abort();
            reject(new Error("Upload canceled"));
          });
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            // progress = (bytes previously uploaded + bytes currently uploading) / total
            const progress = ((start + event.loaded) / totalSize) * 100;
            onProgress(Math.min(progress, 99.9)); // Keep at 99.9 until last chunk resolves
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            try {
              const errorRes = JSON.parse(xhr.responseText);
              reject(new Error(`Cloudinary chunk upload failed: ${errorRes.error?.message || xhr.statusText}`));
            } catch (e) {
              reject(new Error(`Cloudinary chunk upload failed: ${xhr.statusText}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error during Cloudinary upload"));
        xhr.send(chunkFormData);
      });

      lastResponse = result;
      start = end;
      
      if (onProgress) {
        onProgress((start / totalSize) * 100);
      }
    }

    if (!lastResponse) throw new Error("Upload failed: No response from Cloudinary");

    return {
      url: lastResponse.url,
      publicId: lastResponse.public_id,
      secureUrl: lastResponse.secure_url,
    };
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

