-- OMNIS-X Migration 002: Constraints and Indexes

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE public.students
    DROP CONSTRAINT IF EXISTS chk_students_attendance,
    ADD CONSTRAINT chk_students_attendance CHECK (attendance_percent >= 0 AND attendance_percent <= 100),
    DROP CONSTRAINT IF EXISTS chk_students_cgpa,
    ADD CONSTRAINT chk_students_cgpa CHECK (cgpa IS NULL OR (cgpa >= 0 AND cgpa <= 10)),
    DROP CONSTRAINT IF EXISTS chk_students_semester,
    ADD CONSTRAINT chk_students_semester CHECK (semester IN (1, 3, 5, 7, 2, 4, 6, 8)),
    DROP CONSTRAINT IF EXISTS chk_students_residence,
    ADD CONSTRAINT chk_students_residence CHECK (residence_type IN ('Day Scholar', 'Hostel'));

ALTER TABLE public.conflicts
    DROP CONSTRAINT IF EXISTS chk_conflicts_severity,
    ADD CONSTRAINT chk_conflicts_severity CHECK (severity IN ('Critical', 'High', 'Medium', 'Low'));

ALTER TABLE public.incidents
    DROP CONSTRAINT IF EXISTS chk_incidents_severity,
    ADD CONSTRAINT chk_incidents_severity CHECK (severity IN ('Critical', 'High', 'Medium', 'Low'));

ALTER TABLE public.user_roles
    DROP CONSTRAINT IF EXISTS chk_user_roles_role,
    ADD CONSTRAINT chk_user_roles_role CHECK (role IN ('admin', 'faculty', 'coordinator', 'evaluator'));

ALTER TABLE public.dependencies
    DROP CONSTRAINT IF EXISTS chk_dep_strength,
    ADD CONSTRAINT chk_dep_strength CHECK (dependency_strength >= 0 AND dependency_strength <= 1);

-- ============================================================
-- INDEXES FOR QUERY & FILTERING PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_department ON public.students(department);
CREATE INDEX IF NOT EXISTS idx_students_semester_section ON public.students(semester, section);
CREATE INDEX IF NOT EXISTS idx_students_classroom ON public.students(classroom_id);
CREATE INDEX IF NOT EXISTS idx_students_lab ON public.students(lab_id);
CREATE INDEX IF NOT EXISTS idx_students_mentor ON public.students(mentor_id);
CREATE INDEX IF NOT EXISTS idx_students_hostel_room ON public.students(hostel_room) WHERE hostel_room IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_bus_route ON public.students(bus_route) WHERE bus_route IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_exam_status ON public.students(exam_status);
CREATE INDEX IF NOT EXISTS idx_students_placement_status ON public.students(placement_status);

CREATE INDEX IF NOT EXISTS idx_timetable_group ON public.timetable(academic_group_id);
CREATE INDEX IF NOT EXISTS idx_timetable_faculty_slot ON public.timetable(faculty_id, day_of_week, time_slot);
CREATE INDEX IF NOT EXISTS idx_timetable_room_slot ON public.timetable(room_id, day_of_week, time_slot);

CREATE INDEX IF NOT EXISTS idx_dependencies_source ON public.dependencies(source_node_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON public.dependencies(target_node_id);

CREATE INDEX IF NOT EXISTS idx_conflicts_status_sev ON public.conflicts(resolution_status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_events_sim ON public.simulation_events(simulation_id, step_order);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_sim ON public.recovery_plans(simulation_id);
CREATE INDEX IF NOT EXISTS idx_health_recorded ON public.institutional_health(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
