-- ============================================
-- Gatherly - Attendance/Check-in Migration (Corrected)
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

DO $$
BEGIN
    CREATE TYPE check_in_method AS ENUM ('guest_self', 'guest_qr', 'organizer_manual', 'organizer_qr');
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- ============================================
-- ATTENDANCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Guest identification
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  user_fingerprint TEXT,

  -- Check-in details
  companions_count INTEGER NOT NULL DEFAULT 0,
  check_in_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_in_method check_in_method NOT NULL DEFAULT 'guest_self',

  -- Admin tracking
  checked_in_by UUID REFERENCES users(id),

  -- Additional metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS attendance_event_idx ON attendances(event_id);
CREATE INDEX IF NOT EXISTS attendance_email_idx ON attendances(guest_email) WHERE guest_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_phone_idx ON attendances(guest_phone) WHERE guest_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_fingerprint_idx ON attendances(user_fingerprint) WHERE user_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_checkin_time_idx ON attendances(check_in_time);

-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS attendance_event_email_unique
  ON attendances(event_id, guest_email)
  WHERE guest_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_event_phone_unique
  ON attendances(event_id, guest_phone)
  WHERE guest_phone IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY attendances_tenant_policy ON attendances
      FOR ALL USING (event_id IN (SELECT id FROM events WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

    CREATE POLICY attendances_insert_policy ON attendances
      FOR INSERT WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_event_attendance_count(event_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM attendances
    WHERE event_id = event_uuid
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_event_total_guests(event_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT SUM(companions_count + 1)::INTEGER
    FROM attendances
    WHERE event_id = event_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERMISSIONS
-- ============================================

GRANT ALL ON TABLE attendances TO PUBLIC;

COMMENT ON TABLE attendances IS 'Guest attendance/check-in records for events';
COMMENT ON COLUMN attendances.companions_count IS 'Number of additional guests (plus the main guest = total)';
COMMENT ON COLUMN attendances.check_in_method IS 'How the guest checked in: scanned QR themselves, manual entry by organizer, etc.';
