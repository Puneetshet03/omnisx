import type {
  AuthSession,
  CampusBuilding,
  CampusConnection,
  ConflictItem,
  DashboardPayload,
  IncidentItem,
  RecoveryPlan,
  SimulationResult,
  UserRole,
} from "../types";

export const API_BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://127.0.0.1:8000");

let activeRole: UserRole = "admin";
let authToken: string | null = null;

export function setActiveRole(role: UserRole) {
  activeRole = role;
}

export function getActiveRole(): UserRole {
  return activeRole;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Role": activeRole,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || msg;
    } catch {
      // keep default message
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDashboard: () => apiFetch<DashboardPayload>("/api/dashboard"),
  getHealthIndex: () => apiFetch<any>("/api/health-index"),
  updateHealthWeights: (weights: Record<string, number>) =>
    apiFetch<any>("/api/health-index/weights", {
      method: "POST",
      body: JSON.stringify(weights),
    }),
  getAnalytics: () => apiFetch<any>("/api/analytics"),
  getStudents: (params: Record<string, string | number | boolean | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== "ALL") sp.set(k, String(v));
    });
    return apiFetch<any>(`/api/students?${sp.toString()}`);
  },
  getStudentDetail: (id: string) => apiFetch<any>(`/api/students/${id}`),
  getStudentDependencies: (id: string) => apiFetch<any>(`/api/students/${id}/dependencies`),
  getStudentIncidents: (id: string) => apiFetch<any>(`/api/students/${id}/incidents`),
  getDepartments: () => apiFetch<any>("/api/departments"),
  getFaculty: () => apiFetch<any>("/api/faculty"),
  getClassrooms: () => apiFetch<any>("/api/classrooms"),
  getLaboratories: () => apiFetch<any>("/api/laboratories"),
  getTimetable: (dept?: string) => apiFetch<any>(`/api/timetable${dept ? `?department=${dept}` : ""}`),
  getExaminations: () => apiFetch<any>("/api/examinations"),
  getTransportation: () => apiFetch<any>("/api/transportation"),
  getHostels: () => apiFetch<any>("/api/hostels"),
  getPlacements: () => apiFetch<any>("/api/placements"),
  getEvents: () => apiFetch<any>("/api/events"),
  getInfrastructure: () => apiFetch<any>("/api/infrastructure"),
  getCampus: () => apiFetch<{ buildings: CampusBuilding[]; connections: CampusConnection[] }>("/api/campus"),
  getDependencies: (department?: string, resource_type?: string) => {
    const sp = new URLSearchParams();
    if (department && department !== "ALL") sp.set("department", department);
    if (resource_type && resource_type !== "ALL") sp.set("resource_type", resource_type);
    return apiFetch<any>(`/api/dependencies?${sp.toString()}`);
  },
  getConflicts: () => apiFetch<{ total: number; items: ConflictItem[] }>("/api/conflicts"),
  detectConflicts: () => apiFetch<{ total: number; items: ConflictItem[] }>("/api/conflicts/detect", { method: "POST" }),
  getRiskAnalysis: () => apiFetch<any>("/api/risk-analysis"),
  getSimulationCompatibility: () =>
    apiFetch<{
      incident_compatible_types: Record<string, string[]>;
      compatible_resources: Record<
        string,
        { resource_id: string; resource_name: string; resource_type: string; department: string }[]
      >;
    }>("/api/simulations/compatibility"),
  runSimulation: (payload: {
    scenario_name: string;
    incident_type: string;
    affected_resource_id: string;
    severity: string;
    duration_minutes: number;
    horizon_minutes: number;
    use_backups: boolean;
    recovery_priority: string;
  }) => apiFetch<SimulationResult>("/api/simulations", { method: "POST", body: JSON.stringify(payload) }),
  getSimulations: () =>
    apiFetch<{
      items: SimulationResult[];
      active_simulation_id?: string | null;
      historical_affected_count?: number;
      historical_affected_students?: any[];
      historical_simulations_count?: number;
    }>("/api/simulations"),
  getSimulation: (id: string) => apiFetch<SimulationResult>(`/api/simulations/${id}`),
  resetSimulation: (id: string) => apiFetch<any>(`/api/simulations/${id}/reset`, { method: "POST" }),
  compareSimulations: (scenarios: any[]) =>
    apiFetch<any>("/api/simulations/compare", { method: "POST", body: JSON.stringify({ scenarios }) }),
  optimizeRecovery: (payload: {
    simulation_id: string;
    max_budget?: number;
    max_duration_minutes?: number;
    solver_time_limit_seconds?: number;
  }) => apiFetch<{ simulation_id: string; plans: RecoveryPlan[] }>("/api/recovery/optimize", { method: "POST", body: JSON.stringify(payload) }),
  applyRecovery: (payload: { plan_id: string; simulation_id?: string; approver_name: string; notes?: string }) =>
    apiFetch<any>("/api/recovery/apply", { method: "POST", body: JSON.stringify(payload) }),
  runOperationZeroFailure: () =>
    apiFetch<{ simulation: SimulationResult; recovery_plans: RecoveryPlan[] }>("/api/operation-zero-failure", {
      method: "POST",
    }),
  getIncidents: () => apiFetch<{ items: IncidentItem[] }>("/api/incidents"),
  createIncident: (payload: any) => apiFetch<IncidentItem>("/api/incidents", { method: "POST", body: JSON.stringify(payload) }),
  getNotifications: () => apiFetch<{ items: any[] }>("/api/notifications"),
  getAuditLogs: () => apiFetch<{ items: any[] }>("/api/audit-logs"),
  getSystemStatus: () => apiFetch<any>("/api/system/status"),
  queryAssistant: (question: string, simulation_id?: string) =>
    apiFetch<any>("/api/assistant/query", { method: "POST", body: JSON.stringify({ question, simulation_id }) }),
  login: (identifier: string, password: string) =>
    apiFetch<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  demoLogin: (demo_role: "admin" | "operator" | "viewer") =>
    apiFetch<AuthSession>("/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ demo_role }),
    }),
  register: (payload: { username: string; email: string; password: string; role: UserRole }) =>
    apiFetch<AuthSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  firebaseLogin: (payload: {
    uid: string;
    email: string;
    display_name?: string | null;
    role?: UserRole;
    provider?: string;
  }) =>
    apiFetch<AuthSession>("/api/auth/firebase", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
