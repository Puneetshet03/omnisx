export type OperationalStatus =
  | "Operational"
  | "Warning"
  | "Disrupted"
  | "Critical"
  | "Recovering"
  | "Recovered"
  | "Standby"
  | "Scheduled";

export type UserRole = "admin" | "faculty" | "coordinator" | "evaluator";

export interface AuthUser {
  username: string;
  email: string;
  display_name: string;
  role: UserRole;
  role_label: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface DbStatus {
  connected: boolean;
  mode: string;
  backend_framework?: string;
  message: string;
  student_records_loaded?: number;
}

export interface HealthMetrics {
  overall_score: number;
  operational_stability: number;
  academic_continuity: number;
  resource_availability: number;
  exam_readiness: number;
  transport_reliability: number;
  hostel_stability: number;
  infrastructure_stability: number;
  conflict_health: number;
  recovery_readiness: number;
  open_conflict_count: number;
  context_label: string;
  is_model_estimate: boolean;
  recorded_at: string;
}

export interface DashboardPayload {
  db_status: DbStatus;
  kpis: {
    total_students: number;
    total_departments: number;
    total_faculty: number;
    total_classrooms: number;
    total_laboratories: number;
    total_hostel_rooms: number;
    total_bus_routes: number;
    active_conflicts: number;
    critical_incidents: number;
    affected_students: number;
    historical_affected_students?: number;
    available_backups: number;
    institutional_health_index: number;
    academic_continuity: number;
    recovery_readiness: number;
    average_attendance: number;
    average_cgpa: number | null;
    cgpa_valid_observations: number;
  };
  health: HealthMetrics;
  recent_conflicts: ConflictItem[];
  incidents: IncidentItem[];
  department_risk: DepartmentRisk[];
  spof_count: number;
  dataset_metadata: {
    student_source: string;
    supporting_resources_source: string;
  };
}

export interface StudentRecord {
  student_id: string;
  usn: string;
  student_name: string;
  department: string;
  semester: number;
  section: string;
  email?: string;
  attendance_percent: number;
  cgpa: number | null;
  classroom_id: string;
  lab_id: string;
  mentor_id: string;
  residence_type: string;
  hostel_room: string | null;
  bus_route: string | null;
  exam_status: string;
  placement_status: string;
  student_status: string;
  source_type?: string;
}

export interface ConflictItem {
  conflict_id: string;
  conflict_category: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  root_cause: string;
  affected_resource_ids: string[];
  affected_student_ids: string[];
  detection_timestamp: string;
  operational_impact: string;
  suggested_resolution: string;
  resolution_status: string;
}

export interface IncidentItem {
  incident_id: string;
  incident_type: string;
  affected_resource_id: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  title: string;
  description: string;
  status: string;
  reported_by: string;
  reported_at: string;
  resolved_at: string | null;
}

export interface DepartmentRisk {
  department: string;
  student_count: number;
  average_risk_score: number;
  peak_risk_score: number;
  open_conflicts: number;
  risk_level: string;
}

export interface CampusBuilding {
  building_id: string;
  name: string;
  category: string;
  department: string;
  resource_ids: string[];
  position: [number, number, number];
  size: [number, number, number];
  student_count: number;
  status: OperationalStatus;
}

export interface CampusConnection {
  from: string;
  to: string;
  type: string;
}

export interface SimulationEvent {
  step_order: number;
  minute_offset: number;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  building_id: string;
  previous_state: string;
  new_state: OperationalStatus;
  failure_level: string;
  cause_description: string;
}

export interface SimulationResult {
  simulation_id: string;
  scenario_name: string;
  incident_type: string;
  root_resource_id: string;
  root_resource_name?: string;
  root_resource_type?: string;
  severity: string;
  duration_minutes: number;
  horizon_minutes: number;
  use_backups: boolean;
  recovery_priority?: string;
  status: string;
  created_at: string;
  baseline_health: HealthMetrics;
  post_failure_health: HealthMetrics;
  post_recovery_health?: HealthMetrics | null;
  applied_plan_id?: string | null;
  restored_resource_ids?: string[];
  students_restored_count?: number;
  health_drop: number;
  direct_failures: any[];
  indirect_failures: any[];
  downstream_risks: any[];
  affected_resources: any[];
  affected_students: any[];
  affected_student_count: number;
  currently_affected_students?: any[];
  currently_affected_student_count?: number;
  affected_faculty: string[];
  building_statuses: Record<string, OperationalStatus>;
  propagation_edges: { source: string; target: string; dependency_type: string }[];
  timeline_events: SimulationEvent[];
}

export interface RecoveryAction {
  action_id: string;
  action_type: string;
  target_resource_id: string;
  replacement_resource_id: string;
  replacement_name?: string;
  duration_minutes: number;
  estimated_cost: number;
  students_covered: number;
  rationale: string;
}

export interface RecoveryPlan {
  plan_id: string;
  simulation_id: string;
  plan_label: string;
  strategy_name: string;
  solver_status: string;
  is_fallback: boolean;
  objective_score: number;
  estimated_duration_minutes: number;
  estimated_cost: number;
  students_affected: number;
  students_restored: number;
  remaining_disruptions: number;
  recovery_effectiveness_percent: number;
  post_recovery_health: number;
  constraints_satisfied: boolean;
  blocking_constraints: string[];
  actions: RecoveryAction[];
  explanation: string;
  approval_status: string;
}
