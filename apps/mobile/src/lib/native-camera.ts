/**
 * Cámara nativa — usa @capacitor/camera en nativo, fallback a input file en web.
 */

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isNativePlatform } from "./platform";

export interface PhotoResult {
  base64?: string;
  dataUrl?: string;
  webPath?: string;
  format: string;
}

export async function takePhoto(options?: {
  quality?: number;
  allowEditing?: boolean;
  source?: "camera" | "photos" | "prompt";
}): Promise<PhotoResult | null> {
  const quality = options?.quality ?? 80;
  const source = options?.source ?? "camera";

  if (isNativePlatform()) {
    const photo = await Camera.getPhoto({
      quality,
      allowEditing: options?.allowEditing ?? false,
      resultType: CameraResultType.DataUrl,
      source: source === "camera" ? CameraSource.Camera : source === "photos" ? CameraSource.Photos : CameraSource.Prompt,
      saveToGallery: false,
    });
    return {
      dataUrl: photo.dataUrl,
      webPath: photo.webPath,
      format: photo.format,
    };
  }

  // Fallback web: usar input file
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") {
      input.capture = "environment";
    }
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          format: file.type.split("/")[1] || "jpeg",
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function pickFromGallery(): Promise<PhotoResult | null> {
  return takePhoto({ source: "photos", quality: 80 });
}
