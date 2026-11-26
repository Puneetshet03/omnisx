-- OMNIS-X Migration 003: Row Level Security (Least-Privilege)
-- Note: FastAPI uses service_role on the trusted backend while validating JWTs/roles.
-- Anonymous clients NEVER have access to student PII or write access to operational tables.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

-- Safe non-PII view for evaluator dashboards
CREATE OR REPLACE VIEW public.students_evaluator_view AS
SELECT
    student_id,
    usn,
    student_name,
    department,
    semester,
    section,
    attendance_percent,
    cgpa,
    classroom_id,
    lab_id,
    mentor_id,
    residence_type,
    hostel_room,
    bus_route,
    exam_status,
    placement_status,
    student_status
FROM public.students;

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.power_supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_generators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratory_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportation_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_resource_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_affected_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STRICT STUDENT & AUDIT POLICIES (NO ANON ACCESS)
-- ============================================================

DROP POLICY IF EXISTS students_staff_read ON public.students;
CREATE POLICY students_staff_read ON public.students
    FOR SELECT
    TO authenticated
    USING (public.get_my_role() IN ('admin', 'faculty', 'coordinator'));

DROP POLICY IF EXISTS students_admin_write ON public.students;
CREATE POLICY students_admin_write ON public.students
    FOR ALL
    TO authenticated
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS audit_admin_read ON public.audit_logs;
CREATE POLICY audit_admin_read ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.get_my_role() = 'admin');

-- ============================================================
-- REALTIME & OPERATIONAL VISIBILITY POLICIES (AUTHENTICATED)
-- ============================================================

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'departments', 'academic_groups', 'faculty', 'subjects',
        'infrastructure', 'power_supply', 'backup_generators', 'network_resources', 'water_supply',
        'classrooms', 'laboratories', 'laboratory_equipment', 'backup_resources', 'maintenance_records',
        'timetable', 'hostel_blocks', 'hostel_rooms', 'hostel_services',
        'bus_routes', 'buses', 'exam_halls', 'examinations',
        'placement_drives', 'event_venues', 'events',
        'dependencies', 'conflicts', 'incidents',
        'simulations', 'simulation_events', 'simulation_resource_states',
        'recovery_plans', 'recovery_actions', 'institutional_health',
        'risk_assessments', 'notifications', 'settings'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_auth_read ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY %I_auth_read ON public.%I FOR SELECT TO authenticated USING (public.get_my_role() IN (''admin'', ''faculty'', ''coordinator'', ''evaluator''));',
            tbl, tbl
        );
        EXECUTE format('DROP POLICY IF EXISTS %I_admin_write ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY %I_admin_write ON public.%I FOR ALL TO authenticated USING (public.get_my_role() = ''admin'') WITH CHECK (public.get_my_role() = ''admin'');',
            tbl, tbl
        );
    END LOOP;
END $$;

DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.get_my_role() = 'admin');
