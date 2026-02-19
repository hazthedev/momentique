// ============================================
// Galeria - ZIP Export Generator
// ============================================

import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import sharp from 'sharp';
import type { IEvent, IPhoto } from '@/lib/types';

const sanitizeFilename = (value: string) => {
  return value
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
};

const formatDate = (value: Date | string | undefined) => {
  const date = value ? new Date(value) : new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

const getFileExtension = (photo: IPhoto) => {
  if (photo.images?.format) {
    return photo.images.format.replace('.', '').toLowerCase();
  }
  const url = photo.images?.original_url || photo.images?.full_url || '';
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : 'jpg';
};

export const buildPhotoFilename = (eventName: string, photo: IPhoto) => {
  const eventPart = sanitizeFilename(eventName || 'event');
  const datePart = formatDate(photo.created_at);
  const ext = getFileExtension(photo);
  return `${eventPart}_${photo.id}_${datePart}.${ext}`;
};

const fetchImageBuffer = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const applyWatermark = async (buffer: Buffer, label: string) => {
  const watermark = Buffer.from(
    `<svg width="800" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="none"/>
      <text x="98%" y="70%" font-size="48" font-family="Arial, Helvetica, sans-serif"
        fill="rgba(255,255,255,0.75)" text-anchor="end">${label}</text>
    </svg>`
  );

  return sharp(buffer)
    .composite([{ input: watermark, gravity: 'southeast' }])
    .toBuffer();
};

export async function createPhotoExportZip({
  event,
  photos,
  watermark = false,
  includeManifest = true,
  watermarkLabel = 'Galeria',
}: {
  event: IEvent;
  photos: IPhoto[];
  watermark?: boolean;
  includeManifest?: boolean;
  watermarkLabel?: string;
}) {
  const zipStream = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => {
    zipStream.destroy(error);
  });
  archive.pipe(zipStream);

  const manifest = {
    event: {
      id: event.id,
      name: event.name,
      date: event.event_date,
    },
    generated_at: new Date().toISOString(),
    photo_count: photos.length,
    photos: [] as Array<{
      id: string;
      filename: string;
      caption?: string;
      contributor_name?: string;
      status: string;
      created_at: Date;
      original_url: string;
    }>,
  };

  for (const photo of photos) {
    const sourceUrl = photo.images?.original_url || photo.images?.full_url;
    if (!sourceUrl) {
      continue;
    }
    const filename = buildPhotoFilename(event.name, photo);
    const buffer = await fetchImageBuffer(sourceUrl);
    const finalBuffer = watermark ? await applyWatermark(buffer, watermarkLabel) : buffer;

    archive.append(finalBuffer, { name: `photos/${filename}` });

    manifest.photos.push({
      id: photo.id,
      filename,
      caption: photo.caption,
      contributor_name: photo.contributor_name,
      status: photo.status,
      created_at: photo.created_at,
      original_url: sourceUrl,
    });
  }

  if (includeManifest) {
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  }

  archive.finalize();

  const baseName = sanitizeFilename(event.name || 'event');
  const filename = `${baseName}_${formatDate(event.event_date)}.zip`;

  return {
    stream: Readable.toWeb(zipStream) as ReadableStream,
    filename,
  };
}
