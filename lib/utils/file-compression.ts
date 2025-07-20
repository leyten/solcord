import imageCompression from "browser-image-compression"

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file
  }

  try {
    const options = {
      maxSizeMB: 5, // 5MB max
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type as any,
      initialQuality: 0.8,
    }

    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.warn("Image compression failed, using original:", error)
    return file
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return "image"
  if (contentType.startsWith("video/")) return "video"
  if (contentType.startsWith("audio/")) return "audio"
  if (contentType.includes("pdf")) return "pdf"
  if (contentType.includes("zip") || contentType.includes("rar")) return "archive"
  return "file"
}
