import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FastForward,
  History,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { CampusScene } from "../campus3d/CampusScene";
import { DependencyGraphFlow } from "../digital-twin/DependencyGraphFlow";
import { ErrorBoundary, SectionHeader, StatusBadge } from "../components/ui/Primitives";
import type { OperationalStatus } from "../types";

const INCIDENT_PRESETS = [
  { type: "electricity_failure", label: "Electricity Substation Outage", defaultResource: "PWR-ACAD-A" },
  { type: "internet_outage", label: "Campus Network / Exam VLAN Outage", defaultResource: "NET-EXAM" },
  { type: "laboratory_failure", label: "Laboratory Equipment / Power Failure", defaultResource: "LAB-CSE-1" },
  { type: "classroom_unavailability", label: "Classroom Unavailability", defaultResource: "ROOM-CSE-1-A" },
  { type: "faculty_absence", label: "Faculty Unexpected Absence", defaultResource: "FAC-CSE-1" },
  { type: "bus_breakdown", label: "College Bus Route Breakdown", defaultResource: "BUS-01" },
  { type: "driver_unavailability", label: "Driver Unavailability", defaultResource: "DRV-01" },
  { type: "hostel_water_failure", label: "Hostel Water Supply Failure", defaultResource: "WTR-HOSTEL" },
  { type: "exam_hall_failure", label: "Examination Hall Outage", defaultResource: "HALL-EXAM-1" },
  { type: "placement_venue_failure", label: "Placement Venue Disruption", defaultResource: "VENUE-PLACE-1" },
  { type: "event_venue_failure", label: "Seminar / Event Venue Failure", defaultResource: "VENUE-SEMINAR-1" },
];

const STATUS_RANK: Record<string, number> = {
  Critical: 4,
  Disrupted: 3,
  Warning: 2,
  Recovering: 1,
  Recovered: 0,
  Operational: 0,
};

export function SimulationLabPage() {
  const queryClient = useQueryClient();
  const {
    simConfig,
    updateSimConfig,
    activeSimulation,
    setActiveSimulation,
    recoveryPlans,
    setRecoveryPlans,
    appliedPlanId,
    setAppliedPlanId,
    resetTwinState,
    role,
  } = useTwin();

  const { incidentType, resourceId, severity, duration, horizon, useBackups, priority } = simConfig;

  const [centerMode, setCenterMode] = useState<"3d" | "2d">("3d");
  const [playbackStep, setPlaybackStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800);
  const [loadingSim, setLoadingSim] = useState(false);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [compareResults, setCompareResults] = useState<any[] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runSeqRef = useRef(0);
  const lastSimIdRef = useRef<string | null>(null);

  const { data: campus } = useQuery({ queryKey: ["campus"], queryFn: api.getCampus });
  const { data: graphData } = useQuery({ queryKey: ["dependencies"], queryFn: () => api.getDependencies() });
  const { data: compatibility } = useQuery({
    queryKey: ["simulation-compatibility"],
    queryFn: api.getSimulationCompatibility,
  });
  const { data: simulationsHistory } = useQuery({
    queryKey: ["simulations"],
    queryFn: api.getSimulations,
  });

  const compatibleResources = useMemo(
    () => compatibility?.compatible_resources?.[incidentType] || [],
    [compatibility, incidentType]
  );

  const compatibilityError = useMemo(() => {
    const trimmed = resourceId.trim();
    if (!trimmed) return "Target Resource ID is required.";
    if (compatibleResources.length > 0) {
      const match = compatibleResources.find((r) => r.resource_id === trimmed);
      if (!match) {
        const node = graphData?.nodes?.find((n: any) => n.id === trimmed);
        const presetLabel = INCIDENT_PRESETS.find((p) => p.type === incidentType)?.label || incidentType;
        if (node) {
          return `${trimmed} (${node.resource_type}) is incompatible with ${presetLabel}.`;
        }
        return `${trimmed} is not a valid target resource for ${presetLabel}.`;
      }
    }
    return null;
  }, [resourceId, compatibleResources, graphData, incidentType]);

  // Keep replay synced to active simulation transitions
  useEffect(() => {
    const simId = activeSimulation?.simulation_id ?? null;
    if (!simId) {
      lastSimIdRef.current = null;
      setPlaybackStep(0);
      setIsPlaying(false);
      return;
    }
    if (simId !== lastSimIdRef.current) {
      lastSimIdRef.current = simId;
      const total = activeSimulation?.timeline_events?.length || 0;
      if (total > 0) {
        setPlaybackStep(1);
        setIsPlaying(true);
      } else {
        setPlaybackStep(0);
        setIsPlaying(false);
      }
    }
  }, [activeSimulation]);

  const events = activeSimulation?.timeline_events || [];
  const effectiveStep = activeSimulation ? Math.min(Math.max(playbackStep, events.length ? 1 : 0), events.length) : 0;

  useEffect(() => {
    if (!isPlaying || !events.length) return;
    const id = window.setInterval(() => {
      setPlaybackStep((prev) => {
        if (prev >= events.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [isPlaying, events.length, speedMs]);

  const { playbackBuildings, playbackDisruptedIds } = useMemo(() => {
    if (!activeSimulation) {
      return { playbackBuildings: {} as Record<string, OperationalStatus>, playbackDisruptedIds: new Set<string>() };
    }

    const bMap: Record<string, OperationalStatus> = {};
    const dSet = new Set<string>();
    const restoredSet = new Set<string>(activeSimulation.restored_resource_ids || []);
    const isRecovered = Boolean(activeSimulation.applied_plan_id || appliedPlanId);
    const activeEvents = events.slice(0, effectiveStep);

    activeEvents.forEach((ev) => {
      const resourceRestored = isRecovered && (restoredSet.has(ev.resource_id) || (activeSimulation.currently_affected_student_count ?? activeSimulation.affected_student_count) === 0);
      if (!resourceRestored) {
        dSet.add(ev.resource_id);
      }
      if (ev.building_id) {
        const nextState: OperationalStatus = resourceRestored ? "Recovering" : ev.new_state;
        const curState = bMap[ev.building_id];
        if (!curState || (STATUS_RANK[nextState] ?? 0) > (STATUS_RANK[curState] ?? 0)) {
          bMap[ev.building_id] = nextState;
        }
      }
    });

    return { playbackBuildings: bMap, playbackDisruptedIds: dSet };
  }, [activeSimulation, events, effectiveStep, appliedPlanId]);

  const handleIncidentTypeChange = (nextType: string) => {
    runSeqRef.current += 1;
    const compatList = compatibility?.compatible_resources?.[nextType] || [];
    const preset = INCIDENT_PRESETS.find((p) => p.type === nextType);
    const nextResource =
      (preset && (!compatList.length || compatList.some((r) => r.resource_id === preset.defaultResource))
        ? preset.defaultResource
        : compatList[0]?.resource_id) || "";

    updateSimConfig({ incidentType: nextType, resourceId: nextResource }, true);
    setCompareResults(null);
    setPlaybackStep(0);
    setIsPlaying(false);
    setStatusMessage(
      `Configuration updated to ${preset?.label || nextType} (${nextResource}). Click Run Simulation to propagate this incident.`
    );
  };

  const handleResourceChange = (nextResource: string) => {
    runSeqRef.current += 1;
    updateSimConfig({ resourceId: nextResource }, true);
    setCompareResults(null);
    setPlaybackStep(0);
    setIsPlaying(false);
    setStatusMessage(null);
  };

  const handleRunSimulation = async () => {
    if (compatibilityError) {
      setStatusMessage(compatibilityError);
      return;
    }
    const seq = ++runSeqRef.current;
    setLoadingSim(true);
    setStatusMessage(null);
    try {
      const target = resourceId.trim();
      const sim = await api.runSimulation({
        scenario_name: `${incidentType.replace(/_/g, " ")} @ ${target}`,
        incident_type: incidentType,
        affected_resource_id: target,
        severity,
        duration_minutes: duration,
        horizon_minutes: horizon,
        use_backups: useBackups,
        recovery_priority: priority,
      });
      if (seq !== runSeqRef.current) return;
      setActiveSimulation(sim);
      setRecoveryPlans([]);
      setAppliedPlanId(null);
      setCompareResults(null);
      queryClient.invalidateQueries({ queryKey: ["campus"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    } catch (err: any) {
      if (seq === runSeqRef.current) {
        setStatusMessage(err.message || "Simulation failed");
      }
    } finally {
      if (seq === runSeqRef.current) {
        setLoadingSim(false);
      }
    }
  };

  const handleOperationZeroFailure = async () => {
    const seq = ++runSeqRef.current;
    setLoadingSim(true);
    setStatusMessage(null);
    try {
      const res = await api.runOperationZeroFailure();
      if (seq !== runSeqRef.current) return;
      setActiveSimulation(res.simulation);
      setRecoveryPlans(res.recovery_plans);
      setAppliedPlanId(null);
      setCompareResults(null);
      queryClient.invalidateQueries({ queryKey: ["campus"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      setStatusMessage("Operation Zero Failure executed: cascade simulated & CP-SAT plans ready.");
    } finally {
      if (seq === runSeqRef.current) {
        setLoadingSim(false);
      }
    }
  };

  const handleOptimize = async () => {
    if (!activeSimulation) return;
    setLoadingOpt(true);
    try {
      const res = await api.optimizeRecovery({ simulation_id: activeSimulation.simulation_id });
      setRecoveryPlans(res.plans);
      setStatusMessage("OR-Tools CP-SAT generated feasible recovery alternatives.");
    } finally {
      setLoadingOpt(false);
    }
  };

  const handleApplyBestPlan = async () => {
    if (!recoveryPlans.length || !activeSimulation) return;
    const feasible = recoveryPlans.find((p) => p.constraints_satisfied) || recoveryPlans[0];
    try {
      const res = await api.applyRecovery({
        plan_id: feasible.plan_id,
        simulation_id: activeSimulation.simulation_id,
        approver_name: `Command (${role})`,
      });
      setAppliedPlanId(feasible.plan_id);
      if (res.simulation) {
        setActiveSimulation(res.simulation);
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["campus"] });
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      setStatusMessage(`Applied ${feasible.plan_label} (${feasible.strategy_name}) to simulation state.`);
    } catch (err: any) {
      setStatusMessage(err.message);
    }
  };

  const handleCompareScenarios = async () => {
    if (compatibilityError) {
      setStatusMessage(compatibilityError);
      return;
    }
    const target = resourceId.trim();
    const res = await api.compareSimulations([
      {
        scenario_name: `${target} (With Backups)`,
        incident_type: incidentType,
        affected_resource_id: target,
        severity,
        duration_minutes: duration,
        horizon_minutes: horizon,
        use_backups: true,
        recovery_priority: priority,
      },
      {
        scenario_name: `${target} (No Backups)`,
        incident_type: incidentType,
        affected_resource_id: target,
        severity,
        duration_minutes: duration,
        horizon_minutes: horizon,
        use_backups: false,
        recovery_priority: priority,
      },
    ]);
    setCompareResults(res.comparisons);
  };

  const handleReset = async () => {
    runSeqRef.current += 1;
    if (activeSimulation) {
      await api.resetSimulation(activeSimulation.simulation_id);
    }
    resetTwinState();
    setCompareResults(null);
    setPlaybackStep(0);
    setIsPlaying(false);
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["campus"] });
    queryClient.invalidateQueries({ queryKey: ["simulations"] });
    queryClient.invalidateQueries({ queryKey: ["dependencies"] });
    queryClient.invalidateQueries({ queryKey: ["conflicts"] });
    setStatusMessage("Simulation & recovery states reset; baseline institutional records preserved.");
  };

  const currentAffectedStudents = activeSimulation
    ? activeSimulation.currently_affected_students ?? activeSimulation.affected_students
    : [];
  const currentAffectedCount = activeSimulation
    ? activeSimulation.currently_affected_student_count ?? activeSimulation.affected_student_count
    : 0;
  const historicalAffectedCount = simulationsHistory?.historical_affected_count ?? 0;
  const historicalAffectedStudents = simulationsHistory?.historical_affected_students ?? [];

  const projectedRecoveryPlan = recoveryPlans.find((p) => p.constraints_satisfied);
  const postRecoveryScore = activeSimulation?.post_recovery_health
    ? activeSimulation.post_recovery_health.overall_score
    : projectedRecoveryPlan
    ? projectedRecoveryPlan.post_recovery_health
    : null;
  const postRecoveryLabel = activeSimulation?.post_recovery_health
    ? "Applied"
    : projectedRecoveryPlan
    ? `Projected (${projectedRecoveryPlan.plan_label})`
    : "Pending Recovery";

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Interactive Simulation Lab"
        subtitle="Deterministic NetworkX cascading failure propagation, timeline replay, and CP-SAT recovery synthesis"
        right={
          <button
            onClick={handleOperationZeroFailure}
            disabled={loadingSim}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-3.5 py-2 text-xs font-semibold text-white shadow-sm"
          >
            <Zap className="h-4 w-4" />
            Operation Zero Failure
          </button>
        }
      />

      {statusMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
          {statusMessage}
        </div>
      )}

      {/* Three-Panel Simulation Workspace */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* LEFT PANEL: Configuration */}
        <div className="glass-card space-y-3 p-4 xl:col-span-3">
          <h2 className="font-display text-sm font-bold text-[#0F172A]">Incident Configuration</h2>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B]">Incident Type</label>
            <select
              aria-label="Incident Type"
              value={incidentType}
              onChange={(e) => handleIncidentTypeChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              {INCIDENT_PRESETS.map((p) => (
                <option key={p.type} value={p.type}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#64748B]">Target Resource ID</label>
            {compatibleResources.length > 0 && (
              <select
                aria-label="Compatible Target Resource"
                value={compatibleResources.some((r) => r.resource_id === resourceId.trim()) ? resourceId.trim() : ""}
                onChange={(e) => {
                  if (e.target.value) handleResourceChange(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700"
              >
                <option value="" disabled>
                  Select compatible resource ({compatibleResources.length})...
                </option>
                {compatibleResources.map((r) => (
                  <option key={r.resource_id} value={r.resource_id}>
                    {r.resource_id} — {r.resource_name}
                  </option>
                ))}
              </select>
            )}
            <input
              aria-label="Target Resource ID"
              list="compatible-resources-list"
              value={resourceId}
              onChange={(e) => handleResourceChange(e.target.value)}
              placeholder="e.g., PWR-ACAD-A, LAB-CSE-1, BUS-01"
              className={`w-full rounded-xl border px-3 py-2 font-mono text-xs ${
                compatibilityError ? "border-red-300 bg-red-50/40" : "border-slate-200"
              }`}
            />
            <datalist id="compatible-resources-list">
              {compatibleResources.map((r) => (
                <option key={r.resource_id} value={r.resource_id}>
                  {r.resource_name} ({r.resource_type})
                </option>
              ))}
            </datalist>
            {compatibilityError && (
              <p className="flex items-start gap-1 text-[11px] font-medium text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{compatibilityError}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-[#64748B]">Severity</label>
              <select
                aria-label="Severity"
                value={severity}
                onChange={(e) => updateSimConfig({ severity: e.target.value }, true)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#64748B]">Duration (min)</label>
              <input
                type="number"
                min={15}
                max={720}
                value={duration}
                onChange={(e) => updateSimConfig({ duration: Number(e.target.value) }, true)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-[#64748B]">Horizon (min)</label>
              <input
                type="number"
                min={30}
                max={720}
                value={horizon}
                onChange={(e) => updateSimConfig({ horizon: Number(e.target.value) }, true)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#64748B]">Priority</label>
              <select
                value={priority}
                onChange={(e) => updateSimConfig({ priority: e.target.value }, true)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-xs"
              >
                <option value="academic_continuity">Continuity</option>
                <option value="cost">Min Cost</option>
                <option value="speed">Fastest</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={useBackups}
              onChange={(e) => updateSimConfig({ useBackups: e.target.checked }, true)}
            />
            Enable Active Backup Buffering
          </label>

          <div className="space-y-2 pt-1">
            <button
              onClick={handleRunSimulation}
              disabled={loadingSim || Boolean(compatibilityError)}
              className="w-full rounded-xl bg-[#2563EB] py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingSim ? "Propagating Cascade..." : "Run Simulation"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCompareScenarios}
                disabled={Boolean(compatibilityError)}
                className="rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Compare What-If
              </button>
              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            {activeSimulation && (
              <>
                <button
                  onClick={handleOptimize}
                  disabled={loadingOpt}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] py-2 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {loadingOpt ? "Solving CP-SAT..." : "Generate Recovery Plan"}
                </button>
                {recoveryPlans.length > 0 && (
                  <button
                    onClick={handleApplyBestPlan}
                    disabled={Boolean(appliedPlanId || activeSimulation.applied_plan_id)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#10B981] py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {appliedPlanId || activeSimulation.applied_plan_id
                      ? "Recovery Plan Applied"
                      : "Apply Recovery to Simulation"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* CENTER PANEL: 3D Campus / 2D Graph + Playback */}
        <div className="glass-card space-y-3 p-4 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCenterMode("3d")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${centerMode === "3d" ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                3D Campus Propagation
              </button>
              <button
                onClick={() => setCenterMode("2d")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${centerMode === "2d" ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                2D Dependency Cascade
              </button>
            </div>

            {events.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setPlaybackStep((s) => Math.max(1, s - 1));
                  }}
                  aria-label="Previous Step"
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  aria-label="Play or Pause"
                  className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setPlaybackStep((s) => Math.min(events.length, s + 1));
                  }}
                  aria-label="Next Step"
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setSpeedMs((ms) => (ms === 800 ? 350 : 800))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold"
                >
                  <FastForward className="h-3 w-3" /> {speedMs === 350 ? "2x" : "1x"}
                </button>
                <span className="ml-1 font-mono text-[11px] text-slate-600">
                  Step {effectiveStep}/{events.length}
                </span>
              </div>
            )}
          </div>

          {centerMode === "3d" ? (
            <ErrorBoundary>
              <CampusScene
                buildings={campus?.buildings || []}
                connections={campus?.connections || []}
                statusOverrides={activeSimulation ? playbackBuildings : {}}
                selectedBuildingId={null}
                onSelectBuilding={() => {}}
                heightClass="h-[430px]"
              />
            </ErrorBoundary>
          ) : (
            <DependencyGraphFlow graphData={graphData} disruptedIds={playbackDisruptedIds} heightClass="h-[430px]" />
          )}

          {/* Chronological Timeline */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">Failure Replay Timeline</h3>
              {activeSimulation && (
                <span className="font-mono text-[11px] font-semibold text-slate-600">
                  {activeSimulation.incident_type} · {activeSimulation.root_resource_id}
                </span>
              )}
            </div>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
              {events.slice(0, effectiveStep).map((ev) => (
                <div key={ev.step_order} className="flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-2xs">
                  <div>
                    <span className="font-mono font-bold text-[#2563EB]">T+{ev.minute_offset}m</span>{" "}
                    <span className="font-semibold text-slate-900">{ev.resource_id}</span>{" "}
                    <span className="text-slate-500">({ev.failure_level})</span>
                    <p className="text-[11px] text-slate-600">{ev.cause_description}</p>
                  </div>
                  <StatusBadge status={ev.new_state} />
                </div>
              ))}
              {!events.length && (
                <p className="text-xs text-slate-500">Run a simulation or click Operation Zero Failure to replay chronological cascade events.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Real-time Impact Telemetry */}
        <div className="glass-card space-y-3 p-4 xl:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-[#0F172A]">Cascade Impact Intelligence</h2>
            {activeSimulation && <StatusBadge status={activeSimulation.severity} />}
          </div>

          {activeSimulation ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-900">
                  {INCIDENT_PRESETS.find((p) => p.type === activeSimulation.incident_type)?.label ||
                    activeSimulation.incident_type}
                </p>
                <p className="font-mono text-[11px] text-slate-600">
                  Root: {activeSimulation.root_resource_id} · Status: {activeSimulation.status}
                </p>
              </div>

              {/* Distinct Baseline vs Post-Failure vs Post-Recovery Health */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-xl bg-blue-50 p-2">
                  <span className="text-[10px] font-semibold text-blue-700">Baseline</span>
                  <p className="font-display text-base font-bold text-blue-950">
                    {activeSimulation.baseline_health.overall_score}
                  </p>
                  <span className="text-[9px] text-blue-700">Before Incident</span>
                </div>
                <div className="rounded-xl bg-amber-50 p-2">
                  <span className="text-[10px] font-semibold text-amber-700">Post-Failure</span>
                  <p className="font-display text-base font-bold text-amber-950">
                    {activeSimulation.post_failure_health.overall_score}
                  </p>
                  <span className="text-[9px] text-amber-700">-{activeSimulation.health_drop} pts</span>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2">
                  <span className="text-[10px] font-semibold text-emerald-700">Post-Recovery</span>
                  <p className="font-display text-base font-bold text-emerald-950">
                    {postRecoveryScore ?? "--"}
                  </p>
                  <span className="text-[9px] text-emerald-700">{postRecoveryLabel}</span>
                </div>
              </div>

              {/* Current vs Historical Affected Students */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-red-50 p-3">
                  <span className="text-[11px] font-medium text-red-700">Currently Affected</span>
                  <p className="font-display text-2xl font-bold text-red-900">{currentAffectedCount}</p>
                  <span className="text-[10px] text-red-700">
                    {activeSimulation.applied_plan_id ? "Remaining Disrupted" : "Deduplicated CSV IDs"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <span className="text-[11px] font-medium text-slate-700">Historical Affected</span>
                  <p className="font-display text-2xl font-bold text-slate-900">{historicalAffectedCount}</p>
                  <span className="text-[10px] text-slate-600">Prior / Recovered Runs</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2">
                  <p className="font-bold text-slate-900">{activeSimulation.direct_failures.length}</p>
                  <p className="text-[10px] text-slate-500">Direct</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <p className="font-bold text-slate-900">{activeSimulation.indirect_failures.length}</p>
                  <p className="text-[10px] text-slate-500">Indirect</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <p className="font-bold text-slate-900">{activeSimulation.affected_faculty.length}</p>
                  <p className="text-[10px] text-slate-500">Faculty</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800">Affected Resources ({activeSimulation.affected_resources.length})</p>
                <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
                  {activeSimulation.affected_resources.map((r: any) => {
                    const isRestored =
                      Boolean(activeSimulation.applied_plan_id || appliedPlanId) &&
                      ((activeSimulation.restored_resource_ids || []).includes(r.resource_id) ||
                        currentAffectedCount === 0);
                    return (
                      <div key={r.resource_id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                        <span className="truncate font-mono text-[11px] font-semibold text-slate-800">{r.resource_id}</span>
                        <StatusBadge status={isRestored ? "Recovering" : r.state} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  Currently Affected Students ({currentAffectedCount})
                </p>
                <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto">
                  {currentAffectedStudents.slice(0, 15).map((st: any) => (
                    <div key={st.student_id} className="rounded-lg border border-slate-100 px-2.5 py-1.5">
                      <div className="flex justify-between font-semibold text-slate-900">
                        <span>{st.student_id} · {st.student_name}</span>
                        <span>{st.department}</span>
                      </div>
                      <p className="truncate text-[10px] text-slate-500">{st.impact_reasons[0]}</p>
                    </div>
                  ))}
                  {!currentAffectedStudents.length && (
                    <p className="rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800">
                      0 currently affected students.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-[#64748B]">
              <Sparkles className="mb-2 h-5 w-5 text-[#2563EB]" />
              Configure an institutional incident on the left or launch <strong>Operation Zero Failure</strong> to inspect cascading resource and student impacts.
            </div>
          )}

          {/* Historical Affected Students Panel (kept cleanly separate) */}
          <div className="border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                <History className="h-3.5 w-3.5 text-slate-500" />
                Historical Affected Students ({historicalAffectedCount})
              </span>
            </div>
            <div className="mt-1.5 max-h-28 space-y-1 overflow-y-auto">
              {historicalAffectedStudents.slice(0, 10).map((st: any) => (
                <div key={st.student_id} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>{st.student_id} · {st.student_name}</span>
                    <span>{st.department}</span>
                  </div>
                  <p className="truncate text-[10px] text-slate-500">
                    {(st.historical_scenarios || st.impact_reasons || []).join(", ")}
                  </p>
                </div>
              ))}
              {!historicalAffectedStudents.length && (
                <p className="text-[11px] text-slate-400">No historical simulation impacts recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* What-If Comparison Drawer */}
      {compareResults && (
        <div className="glass-card p-4">
          <h3 className="font-display text-sm font-bold text-[#0F172A]">What-If Scenario Comparison</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {compareResults.map((c, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-bold text-slate-900">{c.scenario_name}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div><span className="text-slate-500">Resources</span><p className="font-bold">{c.affected_resources}</p></div>
                  <div><span className="text-slate-500">Students</span><p className="font-bold">{c.affected_students}</p></div>
                  <div><span className="text-slate-500">Post Health</span><p className="font-bold">{c.post_failure_health}/100</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
