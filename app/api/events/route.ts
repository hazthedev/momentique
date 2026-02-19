// ============================================
// Galeria - Events API Routes
// ============================================

import type { NextRequest } from 'next/server';
import {
  handleEventCreate,
  handleEventsBulkDelete,
  handleEventsBulkUpdate,
  handleEventsList,
} from '@/lib/services/events';

// ============================================
// GET /api/events - List events
// ============================================

export async function GET(request: NextRequest) {
  return handleEventsList(request);
}

// ============================================
// POST /api/events - Create event
// ============================================

export async function POST(request: NextRequest) {
  return handleEventCreate(request);
}

// ============================================
// PATCH /api/events - Bulk update events
// ============================================

export async function PATCH(request: NextRequest) {
  return handleEventsBulkUpdate(request);
}

// ============================================
// DELETE /api/events - Bulk delete events
// ============================================

export async function DELETE(request: NextRequest) {
  return handleEventsBulkDelete(request);
}
