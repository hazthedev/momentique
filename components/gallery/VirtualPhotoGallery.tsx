// ============================================
// Galeria - Virtualized Photo Gallery
// ============================================

'use client';

import type { ComponentProps } from 'react';
import { PhotoGallery } from './PhotoGallery';

export default function VirtualPhotoGallery(props: ComponentProps<typeof PhotoGallery>) {
  return <PhotoGallery {...props} virtualize />;
}
