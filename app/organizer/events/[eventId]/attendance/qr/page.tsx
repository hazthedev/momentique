// ============================================
// Redirect to main attendance page
// ============================================

import { redirect } from 'next/navigation';

export default function AttendanceQRRedirectPage() {
  redirect('./');
}
