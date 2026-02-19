// ============================================
// Galeria - Events Page (Redirect)
// ============================================
// This page now redirects to the unified Dashboard

import { redirect } from 'next/navigation';

export default function EventsPage() {
  redirect('/organizer');
}
