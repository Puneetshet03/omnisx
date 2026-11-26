-- OMNIS-X Migration 001: Core Institutional Digital Twin Schema
-- Primary Database: Supabase PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ACADEMIC & STUDENT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.departments (
    department_code VARCHAR(16) PRIMARY KEY,
    department_name VARCHAR(120) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    head_faculty_id VARCHAR(32),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_groups (
    group_id VARCHAR(64) PRIMARY KEY,
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code) ON UPDATE CASCADE,
    semester INTEGER NOT NULL,
    section VARCHAR(8) NOT NULL,
    student_count INTEGER NOT NULL DEFAULT 0,
    primary_classroom_id VARCHAR(64),
    primary_lab_id VARCHAR(64),
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (department, semester, section)
);

CREATE TABLE IF NOT EXISTS public.faculty (
    faculty_id VARCHAR(32) PRIMARY KEY,
    faculty_name VARCHAR(120) NOT NULL,
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code) ON UPDATE CASCADE,
    designation VARCHAR(80) NOT NULL DEFAULT 'Assistant Professor',
    qualifications TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    subjects_qualified TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    max_weekly_hours INTEGER NOT NULL DEFAULT 18,
    current_weekly_hours INTEGER NOT NULL DEFAULT 12,
    availability_status VARCHAR(32) NOT NULL DEFAULT 'Available',
    is_mentor BOOLEAN NOT NULL DEFAULT TRUE,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.faculty_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id VARCHAR(32) NOT NULL REFERENCES public.faculty(faculty_id) ON DELETE CASCADE,
    day_of_week VARCHAR(16) NOT NULL,
    time_slot VARCHAR(32) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    leave_reason TEXT,
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (faculty_id, day_of_week, time_slot)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    subject_code VARCHAR(32) PRIMARY KEY,
    subject_name VARCHAR(140) NOT NULL,
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code) ON UPDATE CASCADE,
    semester INTEGER NOT NULL,
    requires_lab BOOLEAN NOT NULL DEFAULT FALSE,
    required_equipment TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    credits INTEGER NOT NULL DEFAULT 4,
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. RESOURCE & INFRASTRUCTURE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.infrastructure (
    infra_id VARCHAR(64) PRIMARY KEY,
    infra_name VARCHAR(140) NOT NULL,
    infra_type VARCHAR(48) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    capacity NUMERIC(10,2) NOT NULL DEFAULT 100,
    current_load NUMERIC(10,2) NOT NULL DEFAULT 60,
    redundancy_level VARCHAR(32) NOT NULL DEFAULT 'Partial',
    backup_resource_id VARCHAR(64),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    criticality_score INTEGER NOT NULL DEFAULT 90,
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.power_supply (
    power_id VARCHAR(64) PRIMARY KEY REFERENCES public.infrastructure(infra_id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    voltage_kv NUMERIC(6,2) NOT NULL DEFAULT 11.0,
    capacity_kva NUMERIC(10,2) NOT NULL DEFAULT 500.0,
    load_kva NUMERIC(10,2) NOT NULL DEFAULT 320.0,
    feeds_buildings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.backup_generators (
    generator_id VARCHAR(64) PRIMARY KEY REFERENCES public.infrastructure(infra_id) ON DELETE CASCADE,
    generator_name VARCHAR(100) NOT NULL,
    capacity_kva NUMERIC(10,2) NOT NULL DEFAULT 350.0,
    fuel_percent NUMERIC(5,2) NOT NULL DEFAULT 92.0,
    auto_transfer_seconds INTEGER NOT NULL DEFAULT 15,
    covers_buildings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Standby',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.network_resources (
    network_id VARCHAR(64) PRIMARY KEY REFERENCES public.infrastructure(infra_id) ON DELETE CASCADE,
    node_name VARCHAR(100) NOT NULL,
    bandwidth_gbps NUMERIC(6,2) NOT NULL DEFAULT 10.0,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    backup_link_id VARCHAR(64),
    covers_buildings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.water_supply (
    water_id VARCHAR(64) PRIMARY KEY REFERENCES public.infrastructure(infra_id) ON DELETE CASCADE,
    tank_name VARCHAR(100) NOT NULL,
    capacity_liters INTEGER NOT NULL DEFAULT 100000,
    current_level_percent NUMERIC(5,2) NOT NULL DEFAULT 88.0,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    serves_buildings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.classrooms (
    classroom_id VARCHAR(64) PRIMARY KEY,
    classroom_name VARCHAR(120) NOT NULL,
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code) ON UPDATE CASCADE,
    building_id VARCHAR(64) NOT NULL,
    floor_number INTEGER NOT NULL DEFAULT 1,
    capacity INTEGER NOT NULL DEFAULT 60,
    equipment TEXT[] NOT NULL DEFAULT ARRAY['Projector', 'SmartBoard', 'PA-System']::TEXT[],
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    network_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.laboratories (
    lab_id VARCHAR(64) PRIMARY KEY,
    lab_name VARCHAR(140) NOT NULL,
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code) ON UPDATE CASCADE,
    building_id VARCHAR(64) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    workstations INTEGER NOT NULL DEFAULT 40,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    network_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.laboratory_equipment (
    equipment_id VARCHAR(64) PRIMARY KEY,
    lab_id VARCHAR(64) NOT NULL REFERENCES public.laboratories(lab_id) ON DELETE CASCADE,
    equipment_name VARCHAR(120) NOT NULL,
    quantity_total INTEGER NOT NULL DEFAULT 20,
    quantity_operational INTEGER NOT NULL DEFAULT 20,
    requires_power BOOLEAN NOT NULL DEFAULT TRUE,
    requires_network BOOLEAN NOT NULL DEFAULT FALSE,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.backup_resources (
    backup_id VARCHAR(64) PRIMARY KEY,
    backup_name VARCHAR(140) NOT NULL,
    resource_type VARCHAR(48) NOT NULL,
    primary_resource_id VARCHAR(64),
    capacity INTEGER NOT NULL DEFAULT 50,
    activation_minutes INTEGER NOT NULL DEFAULT 10,
    estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 2500.00,
    availability_status VARCHAR(32) NOT NULL DEFAULT 'Available',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_records (
    maintenance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(48) NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.timetable (
    session_id VARCHAR(64) PRIMARY KEY,
    academic_group_id VARCHAR(64) NOT NULL REFERENCES public.academic_groups(group_id),
    subject_code VARCHAR(32) NOT NULL REFERENCES public.subjects(subject_code),
    faculty_id VARCHAR(32) NOT NULL REFERENCES public.faculty(faculty_id),
    room_id VARCHAR(64) NOT NULL,
    room_type VARCHAR(24) NOT NULL DEFAULT 'Classroom',
    day_of_week VARCHAR(16) NOT NULL,
    time_slot VARCHAR(32) NOT NULL,
    session_type VARCHAR(24) NOT NULL DEFAULT 'Lecture',
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. HOSTEL & TRANSPORTATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hostel_blocks (
    block_id VARCHAR(32) PRIMARY KEY,
    block_name VARCHAR(100) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    total_rooms INTEGER NOT NULL DEFAULT 25,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    water_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.hostel_rooms (
    room_id VARCHAR(32) PRIMARY KEY,
    block_id VARCHAR(32) NOT NULL REFERENCES public.hostel_blocks(block_id),
    capacity INTEGER NOT NULL DEFAULT 3,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv'
);

CREATE TABLE IF NOT EXISTS public.hostel_services (
    service_id VARCHAR(64) PRIMARY KEY,
    block_id VARCHAR(32) NOT NULL REFERENCES public.hostel_blocks(block_id),
    service_name VARCHAR(80) NOT NULL,
    dependency_infra_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.bus_routes (
    route_id VARCHAR(32) PRIMARY KEY,
    route_name VARCHAR(120) NOT NULL,
    corridor_area VARCHAR(120) NOT NULL,
    distance_km NUMERIC(6,2) NOT NULL DEFAULT 18.0,
    is_college_bus BOOLEAN NOT NULL DEFAULT TRUE,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv'
);

CREATE TABLE IF NOT EXISTS public.drivers (
    driver_id VARCHAR(32) PRIMARY KEY,
    driver_name VARCHAR(100) NOT NULL,
    license_status VARCHAR(32) NOT NULL DEFAULT 'Active',
    availability_status VARCHAR(32) NOT NULL DEFAULT 'Available',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.buses (
    bus_id VARCHAR(32) PRIMARY KEY,
    route_id VARCHAR(32) NOT NULL REFERENCES public.bus_routes(route_id),
    driver_id VARCHAR(32) REFERENCES public.drivers(driver_id),
    registration_no VARCHAR(32) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 50,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

-- ============================================================
-- 4. AUTHORITATIVE STUDENTS TABLE (200 CSV RECORDS)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.students (
    student_id VARCHAR(32) PRIMARY KEY,
    usn VARCHAR(32) NOT NULL UNIQUE,
    student_name VARCHAR(140) NOT NULL,
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code) ON UPDATE CASCADE,
    semester INTEGER NOT NULL,
    section VARCHAR(8) NOT NULL,
    email VARCHAR(160) NOT NULL,
    attendance_percent NUMERIC(5,2) NOT NULL,
    cgpa NUMERIC(4,2) NULL,
    classroom_id VARCHAR(64) NOT NULL REFERENCES public.classrooms(classroom_id),
    lab_id VARCHAR(64) NOT NULL REFERENCES public.laboratories(lab_id),
    mentor_id VARCHAR(32) NOT NULL REFERENCES public.faculty(faculty_id),
    residence_type VARCHAR(32) NOT NULL,
    hostel_room VARCHAR(32) NULL REFERENCES public.hostel_rooms(room_id),
    bus_route VARCHAR(32) NULL REFERENCES public.bus_routes(route_id),
    exam_status VARCHAR(48) NOT NULL,
    placement_status VARCHAR(48) NOT NULL,
    student_status VARCHAR(32) NOT NULL,
    source_type VARCHAR(32) NOT NULL DEFAULT 'imported_csv',
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hostel_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(32) NOT NULL UNIQUE REFERENCES public.students(student_id) ON DELETE CASCADE,
    room_id VARCHAR(32) NOT NULL REFERENCES public.hostel_rooms(room_id),
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv'
);

CREATE TABLE IF NOT EXISTS public.transportation_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(32) NOT NULL UNIQUE REFERENCES public.students(student_id) ON DELETE CASCADE,
    route_id VARCHAR(32) NOT NULL REFERENCES public.bus_routes(route_id),
    source_type VARCHAR(32) NOT NULL DEFAULT 'derived_from_csv'
);

-- ============================================================
-- 5. EXAMINATIONS, PLACEMENTS & EVENTS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exam_halls (
    hall_id VARCHAR(64) PRIMARY KEY,
    hall_name VARCHAR(120) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 60,
    supports_online_exam BOOLEAN NOT NULL DEFAULT TRUE,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    network_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.examinations (
    exam_id VARCHAR(64) PRIMARY KEY,
    exam_name VARCHAR(140) NOT NULL,
    subject_code VARCHAR(32) REFERENCES public.subjects(subject_code),
    department VARCHAR(16) NOT NULL REFERENCES public.departments(department_code),
    semester INTEGER NOT NULL,
    hall_id VARCHAR(64) NOT NULL REFERENCES public.exam_halls(hall_id),
    invigilator_id VARCHAR(32) NOT NULL REFERENCES public.faculty(faculty_id),
    exam_mode VARCHAR(24) NOT NULL DEFAULT 'Online',
    day_of_week VARCHAR(16) NOT NULL,
    time_slot VARCHAR(32) NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.exam_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id VARCHAR(64) NOT NULL REFERENCES public.examinations(exam_id) ON DELETE CASCADE,
    student_id VARCHAR(32) NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
    seat_number VARCHAR(24) NOT NULL,
    UNIQUE (exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.placement_drives (
    drive_id VARCHAR(64) PRIMARY KEY,
    company_name VARCHAR(120) NOT NULL,
    role_title VARCHAR(120) NOT NULL,
    venue_id VARCHAR(64) NOT NULL,
    eligible_departments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    eligible_semester INTEGER NOT NULL DEFAULT 7,
    day_of_week VARCHAR(16) NOT NULL,
    time_slot VARCHAR(32) NOT NULL,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    network_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.placement_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id VARCHAR(64) NOT NULL REFERENCES public.placement_drives(drive_id) ON DELETE CASCADE,
    student_id VARCHAR(32) NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
    UNIQUE (drive_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.event_venues (
    venue_id VARCHAR(64) PRIMARY KEY,
    venue_name VARCHAR(120) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 180,
    power_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    network_dependency_id VARCHAR(64) REFERENCES public.infrastructure(infra_id),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

CREATE TABLE IF NOT EXISTS public.events (
    event_id VARCHAR(64) PRIMARY KEY,
    event_name VARCHAR(140) NOT NULL,
    event_category VARCHAR(48) NOT NULL,
    venue_id VARCHAR(64) NOT NULL REFERENCES public.event_venues(venue_id),
    target_department VARCHAR(16),
    day_of_week VARCHAR(16) NOT NULL,
    time_slot VARCHAR(32) NOT NULL,
    expected_participants INTEGER NOT NULL DEFAULT 80,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
    source_type VARCHAR(32) NOT NULL DEFAULT 'synthetic_supporting'
);

-- ============================================================
-- 6. INSTITUTIONAL INTELLIGENCE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dependencies (
    dependency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id VARCHAR(64) NOT NULL,
    target_node_id VARCHAR(64) NOT NULL,
    dependency_type VARCHAR(48) NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    dependency_strength NUMERIC(4,2) NOT NULL DEFAULT 0.90,
    propagation_delay_minutes INTEGER NOT NULL DEFAULT 5,
    impact_weight NUMERIC(4,2) NOT NULL DEFAULT 0.85,
    alternative_node_id VARCHAR(64),
    source_type VARCHAR(32) NOT NULL DEFAULT 'modelled_dependency',
    UNIQUE (source_node_id, target_node_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS public.conflicts (
    conflict_id VARCHAR(64) PRIMARY KEY,
    conflict_category VARCHAR(64) NOT NULL,
    severity VARCHAR(24) NOT NULL,
    root_cause TEXT NOT NULL,
    affected_resource_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    affected_student_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    operational_impact TEXT NOT NULL,
    suggested_resolution TEXT NOT NULL,
    resolution_status VARCHAR(32) NOT NULL DEFAULT 'Open',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incidents (
    incident_id VARCHAR(64) PRIMARY KEY,
    incident_type VARCHAR(64) NOT NULL,
    affected_resource_id VARCHAR(64) NOT NULL,
    severity VARCHAR(24) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    reported_by VARCHAR(100) NOT NULL DEFAULT 'Command Centre',
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.simulations (
    simulation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_name VARCHAR(160) NOT NULL,
    incident_type VARCHAR(64) NOT NULL,
    root_resource_id VARCHAR(64) NOT NULL,
    severity VARCHAR(24) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 120,
    horizon_minutes INTEGER NOT NULL DEFAULT 180,
    use_backups BOOLEAN NOT NULL DEFAULT TRUE,
    baseline_health NUMERIC(5,2) NOT NULL,
    post_failure_health NUMERIC(5,2) NOT NULL,
    affected_resource_count INTEGER NOT NULL DEFAULT 0,
    affected_student_count INTEGER NOT NULL DEFAULT 0,
    affected_faculty_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.simulation_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(simulation_id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    minute_offset INTEGER NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    resource_name VARCHAR(140) NOT NULL,
    previous_state VARCHAR(32) NOT NULL,
    new_state VARCHAR(32) NOT NULL,
    failure_level VARCHAR(24) NOT NULL,
    cause_description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.simulation_resource_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(simulation_id) ON DELETE CASCADE,
    resource_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(48) NOT NULL,
    state VARCHAR(32) NOT NULL,
    impact_score NUMERIC(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.simulation_affected_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(simulation_id) ON DELETE CASCADE,
    student_id VARCHAR(32) NOT NULL REFERENCES public.students(student_id),
    impact_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    UNIQUE (simulation_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.recovery_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID REFERENCES public.simulations(simulation_id) ON DELETE SET NULL,
    plan_label VARCHAR(64) NOT NULL,
    strategy_name VARCHAR(120) NOT NULL,
    solver_status VARCHAR(24) NOT NULL,
    objective_score NUMERIC(12,2) NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    estimated_cost NUMERIC(12,2) NOT NULL,
    students_restored INTEGER NOT NULL DEFAULT 0,
    remaining_disruptions INTEGER NOT NULL DEFAULT 0,
    post_recovery_health NUMERIC(5,2) NOT NULL,
    constraints_satisfied BOOLEAN NOT NULL DEFAULT TRUE,
    explanation TEXT NOT NULL,
    approval_status VARCHAR(32) NOT NULL DEFAULT 'Proposed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recovery_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.recovery_plans(plan_id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL,
    target_resource_id VARCHAR(64) NOT NULL,
    replacement_resource_id VARCHAR(64),
    duration_minutes INTEGER NOT NULL,
    estimated_cost NUMERIC(12,2) NOT NULL,
    students_covered INTEGER NOT NULL DEFAULT 0,
    rationale TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institutional_health (
    health_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    overall_score NUMERIC(5,2) NOT NULL,
    academic_continuity NUMERIC(5,2) NOT NULL,
    resource_availability NUMERIC(5,2) NOT NULL,
    exam_readiness NUMERIC(5,2) NOT NULL,
    transport_reliability NUMERIC(5,2) NOT NULL,
    hostel_stability NUMERIC(5,2) NOT NULL,
    infrastructure_stability NUMERIC(5,2) NOT NULL,
    recovery_readiness NUMERIC(5,2) NOT NULL,
    context_label VARCHAR(64) NOT NULL DEFAULT 'baseline',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.risk_assessments (
    risk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id VARCHAR(64) NOT NULL,
    resource_name VARCHAR(140) NOT NULL,
    resource_type VARCHAR(48) NOT NULL,
    department VARCHAR(16),
    betweenness_centrality NUMERIC(6,4) NOT NULL DEFAULT 0,
    dependent_count INTEGER NOT NULL DEFAULT 0,
    is_spof BOOLEAN NOT NULL DEFAULT FALSE,
    risk_score NUMERIC(5,2) NOT NULL,
    preventive_recommendation TEXT NOT NULL,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(140) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(24) NOT NULL DEFAULT 'Info',
    category VARCHAR(48) NOT NULL DEFAULT 'System',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id VARCHAR(100) NOT NULL,
    actor_role VARCHAR(48) NOT NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(48) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ADMINISTRATIVE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    department VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
