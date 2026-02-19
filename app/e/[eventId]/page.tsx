// ============================================
// Galeria - Guest Event Page (Shareable Link)
// ============================================

'use client';

import { useParams } from 'next/navigation';
import { useGuestEventPageController } from './_hooks/useGuestEventPageController';
import { GuestEventPageView } from './_components/GuestEventPageView';

export default function GuestEventPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const controller = useGuestEventPageController(eventId);

  return <GuestEventPageView controller={controller} />;
}
