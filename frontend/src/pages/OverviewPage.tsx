import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Building2,
  Bus,
  Cpu,
  FlaskConical,
  GraduationCap,
  Home,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";
import { CampusScene } from "../campus3d/CampusScene";
import { ErrorBoundary, KpiCard, SectionHeader, StatusBadge } from "../components/ui/Primitives";
import { useTwin } from "../context/TwinContext";
import type { CampusBuilding } from "../types";

const DEPT_COLORS = ["#2563EB", "#7C3AED", "#06B6D4", "#10B981", "#F59E0B"];

export function OverviewPage() {
  const navigate = useNavigate();
  const { activeSimulation, setActiveSimulation, setRecoveryPlans, setAppliedPlanId } = useTwin();
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding | null>(null);
  const [runningOzf, setRunningOzf] = useState(false);

  const { data: dash, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const { data: analytics } = useQuery({ queryKey: ["analytics"], queryFn: api.getAnalytics });
  const { data: campus } = useQuery({ queryKey: ["campus"], queryFn: api.getCampus });

  const handleOzf = async () => {
    setRunningOzf(true);
    try {
      const res = await api.runOperationZeroFailure();
      setActiveSimulation(res.simulation);
      setRecoveryPlans(res.recovery_plans);
      setAppliedPlanId(null);
      navigate("/simulation-lab");
    } finally {
      setRunningOzf(false);
    }
  };

  if (isLoading || !dash) {
    return <div className="p-8 text-sm text-[#64748B]">Loading OMNIS-X institutional command centre...</div>;
  }

  const k = dash.kpis;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Institutional Command Centre"
        subtitle={`Authoritative CSV Students (${k.total_students}) · Model-Based Operational Digital Twin`}
        right={
          <button
            onClick={handleOzf}
            disabled={runningOzf}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Zap className="h-4 w-4" />
            {runningOzf ? "Running Operation Zero Failure..." : "Launch Operation Zero Failure"}
          </button>
        }
      />

      {!dash.db_status.connected && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
          <span className="font-bold">FastAPI Backend Notice:</span> {dash.db_status.message}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard title="Total Students" value={k.total_students} subtitle="Authoritative CSV" icon={GraduationCap} accent="blue" onClick={() => navigate("/students")} />
        <KpiCard title="Departments" value={k.total_departments} subtitle="5 Eng. Streams" icon={Building2} accent="cyan" onClick={() => navigate("/academics")} />
        <KpiCard title="Faculty" value={k.total_faculty} subtitle="Mentors & Lecturers" icon={Users} accent="purple" onClick={() => navigate("/faculty")} />
        <KpiCard title="Classrooms" value={k.total_classrooms} subtitle={`${k.total_laboratories} Labs`} icon={FlaskConical} accent="green" onClick={() => navigate("/laboratories")} />
        <KpiCard title="Hostel & Bus" value={`${k.total_hostel_rooms} / ${k.total_bus_routes}`} subtitle="Rooms / Bus Routes" icon={Bus} accent="cyan" onClick={() => navigate("/transportation")} />
        <KpiCard title="Active Conflicts" value={k.active_conflicts} subtitle={`${dash.spof_count} SPOF Risks`} icon={AlertTriangle} accent="amber" onClick={() => navigate("/conflicts")} />
        <KpiCard title="Health Index" value={`${k.institutional_health_index}`} subtitle="Model Estimate /100" icon={ShieldCheck} accent={k.institutional_health_index >= 80 ? "green" : "amber"} onClick={() => navigate("/risk-intelligence")} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="Academic Continuity" value={`${k.academic_continuity}%`} subtitle={`Avg Attendance ${k.average_attendance}%`} icon={Activity} accent="blue" />
        <KpiCard title="Recovery Readiness" value={`${k.recovery_readiness}%`} subtitle={`${k.available_backups} Backups Armed`} icon={Wrench} accent="purple" />
        <KpiCard
          title="Affected Students"
          value={activeSimulation ? (activeSimulation.currently_affected_student_count ?? activeSimulation.affected_student_count) : k.affected_students}
          subtitle={
            activeSimulation
              ? `${activeSimulation.root_resource_id} · Hist: ${k.historical_affected_students ?? 0}`
              : `No active cascade · Hist: ${k.historical_affected_students ?? 0}`
          }
          icon={Home}
          accent={(activeSimulation ? (activeSimulation.currently_affected_student_count ?? activeSimulation.affected_student_count) : k.affected_students) > 0 ? "red" : "green"}
        />
        <KpiCard title="Mean CGPA (Valid)" value={k.average_cgpa ?? "N/A"} subtitle={`${k.cgpa_valid_observations}/${k.total_students} non-null`} icon={Cpu} accent="cyan" />
      </div>

      {/* 3D Campus + Floating Inspector */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="glass-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A]">Interactive 3D Institutional Digital Twin</h2>
              <p className="text-xs text-[#64748B]">Click any campus building to inspect mapped resource IDs and operational status</p>
            </div>
            <button onClick={() => navigate("/campus-3d")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50">
              Expand 3D View
            </button>
          </div>
          <ErrorBoundary fallbackMessage="3D Campus view encountered a rendering issue">
            <CampusScene
              buildings={campus?.buildings || []}
              connections={campus?.connections || []}
              statusOverrides={activeSimulation?.building_statuses || {}}
              selectedBuildingId={selectedBuilding?.building_id || null}
              onSelectBuilding={(b) => setSelectedBuilding(b)}
              heightClass="h-[390px]"
            />
          </ErrorBoundary>
        </div>

        <div className="glass-card flex flex-col justify-between p-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A]">Building & Resource Telemetry</h2>
            {selectedBuilding ? (
              <div className="mt-3 space-y-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{selectedBuilding.name}</span>
                    <StatusBadge status={activeSimulation?.building_statuses?.[selectedBuilding.building_id] || selectedBuilding.status} />
                  </div>
                  <p className="mt-1 text-slate-500">{selectedBuilding.building_id} • {selectedBuilding.category}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Mapped Institutional Resources</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedBuilding.resource_ids.map((rid) => (
                      <span key={rid} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
                        {rid}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <span className="text-slate-500">Associated Student Exposure</span>
                  <p className="font-display text-xl font-bold text-slate-900">{selectedBuilding.student_count}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#64748B]">Select a 3D campus block to inspect live dependencies and resource IDs.</p>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-bold text-[#0F172A]">Recent Detected Conflicts ({dash.recent_conflicts.length})</p>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {dash.recent_conflicts.map((c) => (
                <div key={c.conflict_id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{c.conflict_category}</span>
                    <StatusBadge status={c.severity} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{c.root_cause}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      {analytics && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="glass-card p-4">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">Department Student Distribution</h3>
            <p className="mb-3 text-xs text-[#64748B]">Exact 200 CSV students across 5 departments</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.department_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {analytics.department_distribution.map((_: any, i: number) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">CGPA Distribution (Valid Observations)</h3>
            <p className="mb-3 text-xs text-[#64748B]">
              {analytics.cgpa_stats.valid_observations} valid, {analytics.cgpa_stats.missing_observations} NULL preserved
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.cgpa_distribution} dataKey="count" nameKey="range" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3}>
                    {analytics.cgpa_distribution.map((_: any, i: number) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">Department Risk Heatmap (Model Estimate)</h3>
            <p className="mb-3 text-xs text-[#64748B]">Centrality & conflict-weighted risk score</p>
            <div className="space-y-2.5 pt-1">
              {dash.department_risk.map((dr) => (
                <div key={dr.department} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{dr.department} ({dr.student_count} students)</span>
                    <span className="font-semibold text-slate-700">{dr.average_risk_score}/100</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${dr.average_risk_score}%`,
                        backgroundColor: dr.average_risk_score >= 65 ? "#EF4444" : dr.average_risk_score >= 45 ? "#F59E0B" : "#10B981",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
