export interface ImageType {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
}

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

/**
 * The real type of an image, read from its first bytes. The name and the Content-Type sent by the
 * client are not trusted: anyone can call a script "cat.png". SVG is deliberately not accepted, because
 * it can carry scripts.
 */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  // WebP: "RIFF" + size + "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}
