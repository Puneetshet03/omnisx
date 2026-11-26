import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { SectionHeader, StatusBadge } from "../components/ui/Primitives";

const COLORS = ["#2563EB", "#7C3AED", "#06B6D4", "#10B981", "#F59E0B"];

export function AnalyticsPage() {
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: api.getAnalytics });
  if (!data) return <div className="p-6 text-xs text-slate-500">Loading analytics...</div>;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Institutional Analytics"
        subtitle={`Derived from 200 authoritative CSV students (${data.cgpa_stats.valid_observations} valid CGPAs, ${data.cgpa_stats.missing_observations} NULL)`}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="glass-card p-4">
          <h3 className="font-display text-sm font-bold">Attendance Distribution</h3>
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attendance_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-4">
          <h3 className="font-display text-sm font-bold">Semester Distribution</h3>
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.semester_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.semester_distribution.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AcademicsPage() {
  const [dept, setDept] = useState("");
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: api.getDepartments });
  const { data: tt } = useQuery({ queryKey: ["timetable", dept], queryFn: () => api.getTimetable(dept || undefined) });

  return (
    <div className="space-y-5">
      <SectionHeader title="Academic Management & Timetable" subtitle="Departments, academic groups, and scheduled lectures/practicals" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {(depts?.items || []).map((d: any) => (
          <div key={d.department_code} className="glass-card p-4 text-xs">
            <p className="font-mono font-bold text-[#2563EB]">{d.department_code}</p>
            <p className="mt-1 font-semibold text-slate-900">{d.department_name}</p>
            <p className="mt-2 text-slate-500">{d.student_count} students · {d.groups?.length || 0} groups</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">Synthetic Demonstration Timetable</h3>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">
            <option value="">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="ISE">ISE</option>
            <option value="ECE">ECE</option>
            <option value="ME">ME</option>
            <option value="CV">CV</option>
          </select>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Faculty</th>
                <th className="px-3 py-2">Room / Lab</th>
                <th className="px-3 py-2">Day & Slot</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(tt?.items || []).slice(0, 45).map((t: any) => (
                <tr key={t.session_id}>
                  <td className="px-3 py-2 font-mono font-semibold text-[#2563EB]">{t.session_id}</td>
                  <td className="px-3 py-2">{t.academic_group_id}</td>
                  <td className="px-3 py-2 font-mono">{t.faculty_id}</td>
                  <td className="px-3 py-2 font-mono">{t.room_id}</td>
                  <td className="px-3 py-2">{t.day_of_week} · {t.time_slot}</td>
                  <td className="px-3 py-2"><StatusBadge status={t.session_type === "Practical" ? "Recovering" : "Scheduled"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function FacultyPage() {
  const { data } = useQuery({ queryKey: ["faculty"], queryFn: api.getFaculty });
  return (
    <div className="space-y-4">
      <SectionHeader title="Faculty & Mentorship Matrix" subtitle="20 mentors derived from CSV with synthetic teaching qualifications & workload limits" />
      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Faculty ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Dept</th>
              <th className="px-4 py-3">Qualifications</th>
              <th className="px-4 py-3">Mentees (CSV)</th>
              <th className="px-4 py-3">Workload</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.items || []).map((f: any) => (
              <tr key={f.faculty_id}>
                <td className="px-4 py-2.5 font-mono font-semibold text-[#2563EB]">{f.faculty_id}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{f.faculty_name}</td>
                <td className="px-4 py-2.5">{f.department}</td>
                <td className="px-4 py-2.5 text-slate-600">{f.qualifications.join(", ")}</td>
                <td className="px-4 py-2.5 font-semibold">{f.mentee_count}</td>
                <td className="px-4 py-2.5">{f.current_weekly_hours} / {f.max_weekly_hours} hrs</td>
                <td className="px-4 py-2.5"><StatusBadge status={f.operational_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClassroomsPage() {
  const { data } = useQuery({ queryKey: ["classrooms"], queryFn: api.getClassrooms });
  return (
    <div className="space-y-4">
      <SectionHeader title="Classroom Inventory" subtitle="40 classrooms derived from CSV student assignments with synthetic capacities & dependencies" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.items || []).map((c: any) => (
          <div key={c.classroom_id} className="glass-card p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-[#2563EB]">{c.classroom_id}</span>
              <StatusBadge status={c.operational_status} />
            </div>
            <p className="mt-1 font-semibold text-slate-900">{c.classroom_name}</p>
            <p className="mt-1 text-slate-500">Assigned: {c.assigned_students} / {c.capacity} seats</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">Power: {c.power_dependency_id} · Net: {c.network_dependency_id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LaboratoriesPage() {
  const { data } = useQuery({ queryKey: ["laboratories"], queryFn: api.getLaboratories });
  return (
    <div className="space-y-4">
      <SectionHeader title="Laboratories & Equipment" subtitle="10 specialized laboratories derived from CSV with power/network dependency mapping" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(data?.items || []).map((l: any) => (
          <div key={l.lab_id} className="glass-card p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-[#7C3AED]">{l.lab_id}</span>
              <StatusBadge status={l.operational_status} />
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900">{l.lab_name}</p>
            <p className="mt-1 text-slate-600">Assigned CSV Students: {l.assigned_students} · Capacity: {l.capacity} workstations</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">Power: {l.power_dependency_id} · Network: {l.network_dependency_id}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(l.equipment || []).map((eq: any) => (
                <span key={eq.equipment_id} className="rounded-lg bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                  {eq.equipment_name} ({eq.quantity_operational}/{eq.quantity_total})
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExaminationsPage() {
  const { data } = useQuery({ queryKey: ["examinations"], queryFn: api.getExaminations });
  return (
    <div className="space-y-5">
      <SectionHeader title="Examination Command" subtitle="Examination halls, mandatory schedules, invigilators, and online network dependencies" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(data?.halls || []).map((h: any) => (
          <div key={h.hall_id} className="glass-card p-4 text-xs">
            <div className="flex justify-between"><span className="font-mono font-bold text-[#2563EB]">{h.hall_id}</span><StatusBadge status={h.operational_status} /></div>
            <p className="mt-1 font-semibold text-slate-900">{h.hall_name}</p>
            <p className="mt-1 text-slate-500">Capacity: {h.capacity} · Online Ready: {h.supports_online_exam ? "Yes" : "Written Only"}</p>
          </div>
        ))}
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr><th className="px-4 py-3">Exam ID</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Dept/Sem</th><th className="px-4 py-3">Hall</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Slot</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.examinations || []).map((e: any) => (
              <tr key={e.exam_id}>
                <td className="px-4 py-2.5 font-mono font-bold text-[#2563EB]">{e.exam_id}</td>
                <td className="px-4 py-2.5 font-semibold">{e.exam_name}</td>
                <td className="px-4 py-2.5">{e.department} Sem-{e.semester}</td>
                <td className="px-4 py-2.5 font-mono">{e.hall_id}</td>
                <td className="px-4 py-2.5"><StatusBadge status={e.exam_mode === "Online" ? "Warning" : "Scheduled"} /></td>
                <td className="px-4 py-2.5">{e.day_of_week} · {e.time_slot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TransportationPage() {
  const { data } = useQuery({ queryKey: ["transportation"], queryFn: api.getTransportation });
  return (
    <div className="space-y-5">
      <SectionHeader title="Transportation & Route Exposure" subtitle="Bus routes derived from CSV bus_route column (BUS-01..BUS-04 + Self)" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(data?.routes || []).map((r: any) => (
          <div key={r.route_id} className="glass-card p-4 text-xs">
            <div className="flex justify-between"><span className="font-mono font-bold text-[#2563EB]">{r.route_id}</span><StatusBadge status={r.operational_status} /></div>
            <p className="mt-1 font-semibold text-slate-900">{r.route_name}</p>
            <p className="text-slate-500">{r.corridor_area}</p>
            <p className="mt-2 font-bold text-slate-800">{r.assigned_students} CSV Students Assigned</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HostelsPage() {
  const { data } = useQuery({ queryKey: ["hostels"], queryFn: api.getHostels });
  return (
    <div className="space-y-5">
      <SectionHeader title="Hostel Operations" subtitle={`35 hostel rooms derived from CSV (${data?.total_hostel_residents || 0} Hostel residents; day scholars excluded)`} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(data?.blocks || []).map((b: any) => (
          <div key={b.block_id} className="glass-card p-4 text-xs">
            <div className="flex justify-between"><span className="font-mono font-bold text-[#2563EB]">{b.block_id}</span><StatusBadge status={b.operational_status} /></div>
            <p className="mt-1 text-sm font-bold text-slate-900">{b.block_name}</p>
            <p className="mt-1 text-slate-500">Power: {b.power_dependency_id} · Water: {b.water_dependency_id}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {(data?.rooms || []).map((rm: any) => (
          <div key={rm.room_id} className="glass-card p-3 text-xs">
            <p className="font-mono font-bold text-slate-900">{rm.room_id}</p>
            <p className="text-[11px] text-slate-500">{rm.block_id}</p>
            <p className="mt-1 font-semibold text-emerald-700">{rm.current_occupancy}/{rm.capacity} occ</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlacementsPage() {
  const { data } = useQuery({ queryKey: ["placements"], queryFn: api.getPlacements });
  return (
    <div className="space-y-4">
      <SectionHeader title="Placement Drives & Readiness" subtitle="Recruitment drives correlated with CSV placement_status" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(data?.drives || []).map((d: any) => (
          <div key={d.drive_id} className="glass-card p-4 text-xs">
            <div className="flex justify-between"><span className="font-mono font-bold text-[#7C3AED]">{d.drive_id}</span><StatusBadge status={d.operational_status} /></div>
            <p className="mt-1 text-sm font-bold text-slate-900">{d.company_name} — {d.role_title}</p>
            <p className="mt-1 text-slate-600">Depts: {d.eligible_departments.join(", ")} (Sem {d.eligible_semester}) · {d.day_of_week} {d.time_slot}</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">Venue: {d.venue_id} · Net: {d.network_dependency_id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventsPage() {
  const { data } = useQuery({ queryKey: ["events"], queryFn: api.getEvents });
  return (
    <div className="space-y-4">
      <SectionHeader title="Campus Events & Venues" subtitle="Seminars, workshops, and venue contention tracking" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(data?.events || []).map((ev: any) => (
          <div key={ev.event_id} className="glass-card p-4 text-xs">
            <div className="flex justify-between"><span className="font-mono font-bold text-[#2563EB]">{ev.event_id}</span><StatusBadge status={ev.operational_status} /></div>
            <p className="mt-1 text-sm font-bold text-slate-900">{ev.event_name}</p>
            <p className="mt-1 text-slate-600">{ev.event_category} · {ev.day_of_week} {ev.time_slot} · {ev.expected_participants} expected</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InfrastructurePage() {
  const { data } = useQuery({ queryKey: ["infrastructure"], queryFn: api.getInfrastructure });
  return (
    <div className="space-y-5">
      <SectionHeader title="Core Campus Infrastructure & Backups" subtitle="Substations, diesel generators, fiber NOC, water systems, and armed backup pools (synthetic supporting data)" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(data?.infrastructure || []).map((inf: any) => (
          <div key={inf.infra_id} className="glass-card p-4 text-xs">
            <div className="flex justify-between"><span className="font-mono font-bold text-[#2563EB]">{inf.infra_id}</span><StatusBadge status={inf.operational_status} /></div>
            <p className="mt-1 font-semibold text-slate-900">{inf.infra_name}</p>
            <p className="mt-1 text-slate-500">{inf.infra_type} · {inf.redundancy_level}</p>
            <p className="mt-1 font-semibold text-slate-700">Criticality: {inf.criticality_score}/100</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-4">
        <h3 className="font-display text-sm font-bold">Armed Backup Resources</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(data?.backup_resources || []).map((b: any) => (
            <div key={b.backup_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex justify-between"><span className="font-mono font-bold text-[#10B981]">{b.backup_id}</span><StatusBadge status={b.availability_status} /></div>
              <p className="mt-1 font-semibold text-slate-900">{b.backup_name}</p>
              <p className="mt-1 text-slate-500">Protects: {b.primary_resource_id} · {b.activation_minutes}m · ₹{b.estimated_cost}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IncidentsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["incidents"], queryFn: api.getIncidents });
  const [title, setTitle] = useState("");
  const [resource, setResource] = useState("PWR-ACAD-A");
  const [severity, setSeverity] = useState("High");
  const [err, setErr] = useState<string | null>(null);

  const handleReport = async () => {
    setErr(null);
    try {
      await api.createIncident({
        incident_type: "operational_alert",
        affected_resource_id: resource,
        severity,
        title: title || `Operational alert on ${resource}`,
        description: `Reported from Incident History console for ${resource}`,
      });
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Incident History & Reporting" subtitle="Operational disruption log synchronized with FastAPI WebSocket / REST" />
      {err && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{err}</div>}
      <div className="glass-card flex flex-wrap items-end gap-3 p-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Incident title..." className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs" />
        <input value={resource} onChange={(e) => setResource(e.target.value)} placeholder="Resource ID" className="w-36 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
        </select>
        <button onClick={handleReport} className="rounded-xl bg-[#EF4444] px-4 py-2 text-xs font-semibold text-white">Log Incident</button>
      </div>
      <div className="space-y-2">
        {(data?.items || []).map((inc) => (
          <div key={inc.incident_id} className="glass-card flex items-center justify-between p-4 text-xs">
            <div>
              <p className="font-bold text-slate-900">{inc.title}</p>
              <p className="text-slate-500">{inc.incident_id} · {inc.affected_resource_id} · {inc.reported_at}</p>
            </div>
            <StatusBadge status={inc.severity} />
          </div>
        ))}
        {!(data?.items || []).length && <p className="text-xs text-slate-500">No active incidents logged yet.</p>}
      </div>
    </div>
  );
}

export function AdministrationPage() {
  const { data: status } = useQuery({ queryKey: ["system-status"], queryFn: api.getSystemStatus });
  const { data: logs, error } = useQuery({ queryKey: ["audit-logs"], queryFn: api.getAuditLogs, retry: false });

  return (
    <div className="space-y-5">
      <SectionHeader title="Governance & Audit Logs" subtitle="Role-based access controls, database connectivity verification, and administrative audit trail" />
      <div className="glass-card p-4 text-xs">
        <h3 className="font-display text-sm font-bold">System & Database Diagnostics</h3>
        <pre className="mt-2 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-300">
          {JSON.stringify(status, null, 2)}
        </pre>
      </div>
      <div className="glass-card p-4 text-xs">
        <h3 className="font-display text-sm font-bold">Administrative Audit Trail</h3>
        {error ? (
          <p className="mt-2 text-amber-700">{(error as Error).message}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {(logs?.items || []).map((l: any) => (
              <div key={l.log_id} className="rounded-xl border border-slate-200 p-2.5">
                <span className="font-bold text-[#2563EB]">{l.action}</span> · {l.actor_id} ({l.actor_role}) · {l.entity_type}/{l.entity_id}
              </div>
            ))}
            {!(logs?.items || []).length && <p className="text-slate-500">No administrative actions recorded yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["health-index"], queryFn: api.getHealthIndex });
  const [weights, setWeights] = useState<Record<string, number>>({
    academic_continuity: 0.25,
    resource_availability: 0.20,
    exam_readiness: 0.15,
    transport_reliability: 0.10,
    hostel_stability: 0.10,
    infrastructure_stability: 0.12,
    conflict_penalty: 0.08,
  });
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setMsg(null);
    try {
      await api.updateHealthWeights(weights);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["health-index"] });
      setMsg("Institutional Health Index weights updated.");
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Settings & Health Index Weights" subtitle="Configure model weights for the Institutional Health Index (must sum to ~1.0)" />
      {msg && <div className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">{msg}</div>}
      <div className="glass-card max-w-xl space-y-3 p-5 text-xs">
        {Object.entries(data?.weights || weights).map(([k]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <label className="font-semibold capitalize text-slate-700">{k.replace(/_/g, " ")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={weights[k]}
              onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              className="w-24 rounded-lg border border-slate-200 px-2.5 py-1 text-right"
            />
          </div>
        ))}
        <button onClick={handleSave} className="mt-2 rounded-xl bg-[#2563EB] px-4 py-2 font-semibold text-white">
          Save Weight Configuration
        </button>
      </div>
    </div>
  );
}
