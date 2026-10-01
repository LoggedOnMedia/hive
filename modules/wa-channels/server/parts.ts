import { MEDIA } from "../config";

// A post goes out to each channel as an ordered run of "parts":
//   media items in order (image/video), with the caption on the LAST one;
//   or, when the caption is too long for media (> 1,024 chars), the media
//   without captions followed by the caption as its own text post;
//   or just a text post when there's no media.

export type MediaItem = { path: string; mime: string };
export type Part = { kind: "image" | "video" | "text"; path?: string; caption: string };

const kindOf = (mime: string): "image" | "video" => (mime.startsWith("video/") ? "video" : "image");

export function buildParts(caption: string, media: MediaItem[]): Part[] {
  const text = caption.trim();
  if (media.length === 0) return text ? [{ kind: "text", caption: text }] : [];

  const captionOnMedia = text.length > 0 && text.length <= MEDIA.captionMax;
  const parts: Part[] = media.map((m, i) => ({
    kind: kindOf(m.mime),
    path: m.path,
    caption: captionOnMedia && i === media.length - 1 ? text : "",
  }));
  if (text && !captionOnMedia) parts.push({ kind: "text", caption: text });
  return parts;
}
