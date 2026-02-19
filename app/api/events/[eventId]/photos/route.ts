// ============================================
// Galeria - Photo Upload API Route
// ============================================

import type { NextRequest } from 'next/server';
import {
  handleEventPhotoList,
  handleEventPhotoUpload,
} from '@/lib/services/event-photos';

// ============================================
// POST /api/events/:eventId/photos - Upload photo
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  return handleEventPhotoUpload(request, eventId);
}

// ============================================
// GET /api/events/:eventId/photos - List photos
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  return handleEventPhotoList(request, eventId);
}