import React, { createContext, useCallback, useContext, useState } from "react";
import type { AuthSession, AuthUser, RecoveryPlan, SimulationResult, UserRole } from "../types";
import { setActiveRole, setAuthToken } from "../services/api";
import { signOutFirebase } from "../services/firebase";

export interface SimulationConfig {
  incidentType: string;
  resourceId: string;
  severity: string;
  duration: number;
  horizon: number;
  useBackups: boolean;
  priority: string;
}

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  incidentType: "electricity_failure",
  resourceId: "PWR-ACAD-A",
  severity: "Critical",
  duration: 120,
  horizon: 180,
  useBackups: true,
  priority: "academic_continuity",
};

const AUTH_STORAGE_KEY = "omnisx_auth_session";

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed?.access_token && parsed?.user?.role) {
      setActiveRole(parsed.user.role);
      setAuthToken(parsed.access_token);
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

interface TwinContextValue {
  authUser: AuthUser | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  simConfig: SimulationConfig;
  updateSimConfig: (patch: Partial<SimulationConfig>, clearStaleSimulation?: boolean) => void;
  activeSimulation: SimulationResult | null;
  setActiveSimulation: (sim: SimulationResult | null) => void;
  recoveryPlans: RecoveryPlan[];
  setRecoveryPlans: (plans: RecoveryPlan[]) => void;
  appliedPlanId: string | null;
  setAppliedPlanId: (id: string | null) => void;
  resetTwinState: () => void;
  selectedBuildingId: string | null;
  setSelectedBuildingId: (id: string | null) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
}

const TwinContext = createContext<TwinContextValue | null>(null);

export function TwinProvider({ children }: { children: React.ReactNode }) {
  const initialSession = readStoredSession();
  const [authUser, setAuthUser] = useState<AuthUser | null>(initialSession?.user ?? null);
  const [role, setRoleState] = useState<UserRole>(initialSession?.user?.role ?? "admin");
  const [simConfig, setSimConfig] = useState<SimulationConfig>(DEFAULT_SIM_CONFIG);
  const [activeSimulation, setActiveSimulationState] = useState<SimulationResult | null>(null);
  const [recoveryPlans, setRecoveryPlans] = useState<RecoveryPlan[]>([]);
  const [appliedPlanId, setAppliedPlanId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState<string>("");

  const setRole = useCallback((nextRole: UserRole) => {
    setActiveRole(nextRole);
    setRoleState(nextRole);
  }, []);

  const signIn = useCallback((session: AuthSession) => {
    setActiveRole(session.user.role);
    setAuthToken(session.access_token);
    setRoleState(session.user.role);
    setAuthUser(session.user);
    try {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore storage errors
    }
  }, []);

  const signOut = useCallback(() => {
    void signOutFirebase();
    setAuthToken(null);
    setActiveRole("admin");
    setAuthUser(null);
    setActiveSimulationState(null);
    setRecoveryPlans([]);
    setAppliedPlanId(null);
    try {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Synchronize Incident Configuration whenever a simulation becomes active
  const setActiveSimulation = useCallback((sim: SimulationResult | null) => {
    setActiveSimulationState(sim);
    if (sim) {
      setSimConfig({
        incidentType: sim.incident_type,
        resourceId: sim.root_resource_id,
        severity: sim.severity,
        duration: sim.duration_minutes,
        horizon: sim.horizon_minutes,
        useBackups: sim.use_backups,
        priority: sim.recovery_priority || "academic_continuity",
      });
      if (sim.applied_plan_id) {
        setAppliedPlanId(sim.applied_plan_id);
      }
    }
  }, []);

  // Prevent stale simulation results from showing alongside a newly selected incident configuration
  const updateSimConfig = useCallback(
    (patch: Partial<SimulationConfig>, clearStaleSimulation = true) => {
      setSimConfig((prev) => {
        const next = { ...prev, ...patch };
        if (clearStaleSimulation) {
          setActiveSimulationState((curSim) => {
            if (!curSim) return null;
            const changed =
              next.incidentType !== curSim.incident_type ||
              next.resourceId.trim() !== curSim.root_resource_id ||
              next.severity !== curSim.severity ||
              next.duration !== curSim.duration_minutes ||
              next.horizon !== curSim.horizon_minutes ||
              next.useBackups !== curSim.use_backups ||
              next.priority !== (curSim.recovery_priority || "academic_continuity");
            if (changed) {
              setRecoveryPlans([]);
              setAppliedPlanId(null);
              return null;
            }
            return curSim;
          });
        }
        return next;
      });
    },
    []
  );

  const resetTwinState = useCallback(() => {
    setActiveSimulationState(null);
    setRecoveryPlans([]);
    setAppliedPlanId(null);
  }, []);

  return (
    <TwinContext.Provider
      value={{
        authUser,
        signIn,
        signOut,
        role,
        setRole,
        simConfig,
        updateSimConfig,
        activeSimulation,
        setActiveSimulation,
        recoveryPlans,
        setRecoveryPlans,
        appliedPlanId,
        setAppliedPlanId,
        resetTwinState,
        selectedBuildingId,
        setSelectedBuildingId,
        globalSearch,
        setGlobalSearch,
      }}
    >
      {children}
    </TwinContext.Provider>
  );
}

export function useTwin() {
  const ctx = useContext(TwinContext);
  if (!ctx) throw new Error("useTwin must be used inside TwinProvider");
  return ctx;
}
