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
    const configuredChunkSizeMb = Number(process.env.NEXT_PUBLIC_CLOUDINARY_CHUNK_SIZE_MB || "5");
    const configuredTimeoutMs = Number(process.env.NEXT_PUBLIC_CLOUDINARY_REQUEST_TIMEOUT_MS || "45000");
    const configuredRetryCount = Number(process.env.NEXT_PUBLIC_CLOUDINARY_CHUNK_RETRY || "2");

    const chunkSizeMb = Number.isFinite(configuredChunkSizeMb) && configuredChunkSizeMb > 0
      ? configuredChunkSizeMb
      : 5;
    const requestTimeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
      ? Math.floor(configuredTimeoutMs)
      : 45000;
    const retryCount = Number.isFinite(configuredRetryCount) && configuredRetryCount >= 0
      ? Math.floor(configuredRetryCount)
      : 2;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary credentials missing in .env.local");
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("Bạn đang offline. Vui lòng kiểm tra kết nối mạng rồi thử lại.");
    }

    const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const executeWithRetry = async <T>(
      label: string,
      operation: (attempt: number) => Promise<T>
    ): Promise<T> => {
      const maxAttempts = retryCount + 1;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation(attempt);
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          if (message === "Upload canceled") {
            throw error;
          }

          const isLastAttempt = attempt === maxAttempts;
          console.warn(`[Cloudinary] ${label} failed (attempt ${attempt}/${maxAttempts})`, error);
          if (isLastAttempt) {
            break;
          }

          await wait(Math.min(1000 * attempt, 4000));
        }
      }

      if (lastError instanceof Error) {
        throw lastError;
      }

      throw new Error(`${label} failed`);
    };

    const sendUploadRequest = async (input: {
      payload: FormData;
      startByte: number;
      endByte: number;
      totalBytes: number;
      useChunkHeaders: boolean;
      uploadId?: string;
      label: string;
    }) => {
      return new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;

        const cleanup = () => {
          if (abortController) {
            abortController.signal.removeEventListener("abort", onAbort);
          }
        };

        const finalizeResolve = (value: any) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };

        const finalizeReject = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        const onAbort = () => {
          xhr.abort();
          finalizeReject(new Error("Upload canceled"));
        };

        xhr.open("POST", uploadEndpoint);
        xhr.timeout = requestTimeoutMs;

        if (input.useChunkHeaders && input.uploadId) {
          xhr.setRequestHeader("X-Unique-Upload-Id", input.uploadId);
          xhr.setRequestHeader("Content-Range", `bytes ${input.startByte}-${input.endByte}/${input.totalBytes}`);
        }

        if (abortController) {
          abortController.signal.addEventListener("abort", onAbort, { once: true });
        }

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || !onProgress) return;
          const uploaded = input.useChunkHeaders ? input.startByte + event.loaded : event.loaded;
          const safeTotalBytes = input.totalBytes > 0 ? input.totalBytes : 1;
          const progress = (uploaded / safeTotalBytes) * 100;
          onProgress(Math.min(progress, 99.9));
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText || "{}");
              finalizeResolve(response);
            } catch {
              finalizeReject(new Error(`${input.label} failed: Cloudinary trả dữ liệu không hợp lệ`));
            }
            return;
          }

          if (xhr.status === 0) {
            finalizeReject(new Error(`${input.label} failed: network bị chặn hoặc kết nối bị gián đoạn`));
            return;
          }

          try {
            const errorRes = JSON.parse(xhr.responseText || "{}");
            finalizeReject(
              new Error(`${input.label} failed: ${errorRes.error?.message || xhr.statusText || `HTTP ${xhr.status}`}`)
            );
          } catch {
            finalizeReject(new Error(`${input.label} failed: ${xhr.statusText || `HTTP ${xhr.status}`}`));
          }
        };

        xhr.onerror = () => {
          finalizeReject(new Error(`${input.label} failed: Network error during Cloudinary upload`));
        };

        xhr.ontimeout = () => {
          finalizeReject(new Error(`${input.label} timeout sau ${requestTimeoutMs}ms`));
        };

        xhr.onabort = () => {
          finalizeReject(new Error("Upload canceled"));
        };

        xhr.send(input.payload);
      });
    };

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

    const chunkSize = Math.floor(chunkSizeMb * 1024 * 1024);
    const totalSize = file.size;
    const uniqueUploadId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // For small files, use one request to reduce header/preflight overhead.
    if (totalSize <= chunkSize) {
      const response = await executeWithRetry("Cloudinary upload", async () => {
        return sendUploadRequest({
          payload: formData,
          startByte: 0,
          endByte: Math.max(totalSize - 1, 0),
          totalBytes: totalSize,
          useChunkHeaders: false,
          label: "Cloudinary upload",
        });
      });

      if (onProgress) {
        onProgress(100);
      }

      return {
        url: response.url,
        publicId: response.public_id,
        secureUrl: response.secure_url,
      };
    }
    
    let start = 0;
    let lastResponse: any = null;
    let chunkIndex = 0;

    while (start < totalSize) {
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = file.slice(start, end);
      chunkIndex += 1;
      
      const chunkFormData = new FormData();
      // Copy metadata once (usually only need preset for subsequent chunks, but safe to include)
      chunkFormData.append("file", chunk);
      chunkFormData.append("upload_preset", uploadPreset);
      chunkFormData.append("folder", `AI4Autism/${centerNameClean}/Children/${childIdClean}`);
      chunkFormData.append("public_id", `${roleCapitalized}_${childIdClean}_${locationSlug}-${dateStr}${indexStr}`);
      chunkFormData.append("tags", `${childIdClean},${centerNameClean},${roleCapitalized},vst-auto-upload`);

      const currentStart = start;
      const currentEnd = end;
      const result = await executeWithRetry(`Cloudinary chunk ${chunkIndex}/${totalChunks}`, async () => {
        return sendUploadRequest({
          payload: chunkFormData,
          startByte: currentStart,
          endByte: currentEnd - 1,
          totalBytes: totalSize,
          useChunkHeaders: true,
          uploadId: uniqueUploadId,
          label: `Cloudinary chunk ${chunkIndex}/${totalChunks}`,
        });
      });

      lastResponse = result;
      start = end;
      
      if (onProgress) {
        onProgress((start / totalSize) * 100);
      }
    }

    if (!lastResponse) throw new Error("Upload failed: No response from Cloudinary");

    if (onProgress) {
      onProgress(100);
    }

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
    if (!obfuscatedUrl || typeof obfuscatedUrl !== "string") return "";

    const normalize = (url: string) => {
      if (url.startsWith("//")) return `https:${url}`;
      if (url.startsWith("res.cloudinary.com/")) return `https://${url}`;
      return url;
    };

    const isAbsoluteOrCloudinary = (value: string) =>
      /^https?:\/\//i.test(value) || value.startsWith("//") || value.startsWith("res.cloudinary.com/");

    const raw = obfuscatedUrl.trim();
    if (isAbsoluteOrCloudinary(raw)) {
      return normalize(raw);
    }

    const decode = (value: string) => {
      try {
        return atob(value).trim();
      } catch {
        return null;
      }
    };

    const firstDecode = decode(raw);
    if (firstDecode) {
      if (isAbsoluteOrCloudinary(firstDecode)) {
        return normalize(firstDecode);
      }

      // Support legacy/double-encoded payloads.
      const secondDecode = decode(firstDecode);
      if (secondDecode && isAbsoluteOrCloudinary(secondDecode)) {
        return normalize(secondDecode);
      }
    }

    // Keep raw value as last fallback so caller can decide alternate behavior.
    return raw;
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

