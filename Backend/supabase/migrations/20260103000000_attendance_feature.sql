-- =============================================================================
-- Staff Attendance Management Feature
-- Tracks daily attendance for all staff members (doctors, receptionists, etc.)
-- Supports: calendar view, bulk marking, import/export, leave management
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Attendance Records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
  check_in_time TIME,
  check_out_time TIME,
  working_hours DECIMAL(4,2), -- calculated from check-in/check-out or manually set
  notes TEXT,
  marked_by_id UUID REFERENCES users(id), -- admin who marked attendance
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, attendance_date) -- one record per user per day
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_clinic ON attendance(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

COMMENT ON TABLE attendance IS 'Daily attendance records for all staff members';
COMMENT ON COLUMN attendance.status IS 'present, absent, half_day, leave, holiday';
COMMENT ON COLUMN attendance.working_hours IS 'Total hours worked (auto-calculated or manual)';

-- ---------------------------------------------------------------------------
-- 2. Leave Requests (Optional - for leave approval workflow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'casual', 'earned', 'unpaid', 'emergency')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

COMMENT ON TABLE leave_requests IS 'Staff leave requests with approval workflow';
COMMENT ON COLUMN leave_requests.leave_type IS 'sick, casual, earned, unpaid, emergency';

-- ---------------------------------------------------------------------------
-- 3. Update permission matrix for attendance module
-- ---------------------------------------------------------------------------
INSERT INTO role_permissions (role, module, action, allowed) VALUES
  ('admin', 'attendance', 'view', TRUE),
  ('admin', 'attendance', 'mark', TRUE),
  ('admin', 'attendance', 'export', TRUE),
  ('admin', 'attendance', 'import', TRUE),
  ('receptionist', 'attendance', 'view', FALSE), -- Can be enabled if needed
  ('doctor', 'attendance', 'view', FALSE) -- Doctors can only view their own (future: self-service)
ON CONFLICT (role, module, action) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. RLS Policies for attendance (admin-only for now)
-- ---------------------------------------------------------------------------
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY attendance_admin_all ON attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY leave_requests_admin_all ON leave_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Staff can view their own attendance (future enhancement)
CREATE POLICY attendance_own_read ON attendance
  FOR SELECT USING (user_id = auth.uid());

-- Staff can view their own leave requests
CREATE POLICY leave_requests_own_read ON leave_requests
  FOR SELECT USING (user_id = auth.uid());

-- Staff can create their own leave requests
CREATE POLICY leave_requests_own_create ON leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Trigger to auto-calculate working_hours from check-in/check-out
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_working_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if both check_in and check_out are provided
  IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
    -- Calculate difference in hours (handles midnight crossing)
    NEW.working_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
    
    -- If negative (crossed midnight), add 24 hours
    IF NEW.working_hours < 0 THEN
      NEW.working_hours := NEW.working_hours + 24;
    END IF;
  ELSIF NEW.status = 'half_day' AND NEW.working_hours IS NULL THEN
    -- Default half day = 4 hours if not specified
    NEW.working_hours := 4.0;
  ELSIF NEW.status = 'present' AND NEW.working_hours IS NULL THEN
    -- Default full day = 8 hours if not specified
    NEW.working_hours := 8.0;
  ELSIF NEW.status IN ('absent', 'leave', 'holiday') THEN
    -- No hours for absent/leave/holiday
    NEW.working_hours := 0;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_calculate_hours
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION calculate_working_hours();

COMMENT ON FUNCTION calculate_working_hours() IS 'Auto-calculates working_hours from check_in/check_out times';

-- ---------------------------------------------------------------------------
-- 6. Helper function: Get attendance summary for a user in a date range
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_attendance_summary(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_days BIGINT,
  present_days BIGINT,
  absent_days BIGINT,
  leave_days BIGINT,
  half_days BIGINT,
  holiday_days BIGINT,
  total_hours NUMERIC,
  attendance_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_days,
    COUNT(*) FILTER (WHERE status = 'present') AS present_days,
    COUNT(*) FILTER (WHERE status = 'absent') AS absent_days,
    COUNT(*) FILTER (WHERE status = 'leave') AS leave_days,
    COUNT(*) FILTER (WHERE status = 'half_day') AS half_days,
    COUNT(*) FILTER (WHERE status = 'holiday') AS holiday_days,
    COALESCE(SUM(working_hours), 0) AS total_hours,
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('present', 'half_day'))::NUMERIC / 
       NULLIF(COUNT(*) FILTER (WHERE status != 'holiday'), 0)::NUMERIC * 100),
      2
    ) AS attendance_rate
  FROM attendance
  WHERE user_id = p_user_id
    AND attendance_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_attendance_summary IS 'Returns attendance statistics for a user in a date range';

-- ---------------------------------------------------------------------------
-- 7. Seed sample attendance data (last 7 days for testing)
-- ---------------------------------------------------------------------------
-- This will be populated by the seeder or via import, leaving empty for now

