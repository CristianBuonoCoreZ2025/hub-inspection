import heic2any from "heic2any";

const HEIC_EXTENSIONS = /\.(heic|heif)$/i;
const HEIC_MIME = /^image\/(heic|heif)$/i;

export function isHeic(file: File): boolean {
  return HEIC_MIME.test(file.type) || HEIC_EXTENSIONS.test(file.name);
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(HEIC_EXTENSIONS, ".jpg");
  return new File([blob], newName, { type: "image/jpeg" });
}
