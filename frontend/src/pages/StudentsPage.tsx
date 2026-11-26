import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Search, X } from "lucide-react";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { SectionHeader, StatusBadge } from "../components/ui/Primitives";
import type { StudentRecord } from "../types";

export function StudentsPage() {
  const { globalSearch, role } = useTwin();
  const [search, setSearch] = useState(globalSearch);
  const [department, setDepartment] = useState("ALL");
  const [semester, setSemester] = useState("ALL");
  const [section, setSection] = useState("ALL");
  const [residenceType, setResidenceType] = useState("ALL");
  const [examStatus, setExamStatus] = useState("ALL");
  const [placementStatus, setPlacementStatus] = useState("ALL");
  const [cgpaAvail, setCgpaAvail] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (globalSearch) setSearch(globalSearch);
  }, [globalSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, department, semester, section, residenceType, examStatus, placementStatus, cgpaAvail, page, role],
    queryFn: () =>
      api.getStudents({
        search,
        department,
        semester: semester === "ALL" ? undefined : Number(semester),
        section,
        residence_type: residenceType,
        exam_status: examStatus,
        placement_status: placementStatus,
        cgpa_available: cgpaAvail === "ALL" ? undefined : cgpaAvail === "YES",
        page,
        page_size: 20,
      }),
  });

  const { data: detail } = useQuery({
    queryKey: ["student-detail", selectedId, role],
    queryFn: () => api.getStudentDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const { data: deps } = useQuery({
    queryKey: ["student-deps", selectedId],
    queryFn: () => api.getStudentDependencies(selectedId!),
    enabled: Boolean(selectedId),
  });

  const { data: incidents } = useQuery({
    queryKey: ["student-incidents", selectedId],
    queryFn: () => api.getStudentIncidents(selectedId!),
    enabled: Boolean(selectedId),
  });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Student Intelligence Directory"
        subtitle="Authoritative 200-student CSV dataset · Missing CGPA, hostel room, and bus route preserved as NULL / Not Available"
        right={
          data?.pii_redacted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <Lock className="h-3.5 w-3.5" />
              Evaluator View: Contact Emails Protected
            </span>
          ) : null
        }
      />

      {/* Filters Bar */}
      <div className="glass-card grid grid-cols-2 gap-3 p-4 md:grid-cols-4 lg:grid-cols-8">
        <div className="relative col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name, STU-ID, or USN..."
            className="w-full rounded-xl border border-slate-200 py-1.5 pr-3 pl-9 text-xs"
          />
        </div>
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs">
          <option value="ALL">All Depts</option>
          <option value="CSE">CSE</option>
          <option value="ISE">ISE</option>
          <option value="ECE">ECE</option>
          <option value="ME">ME</option>
          <option value="CV">CV</option>
        </select>
        <select value={semester} onChange={(e) => { setSemester(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs">
          <option value="ALL">All Sems</option>
          <option value="1">Sem 1</option>
          <option value="3">Sem 3</option>
          <option value="5">Sem 5</option>
          <option value="7">Sem 7</option>
        </select>
        <select value={section} onChange={(e) => { setSection(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs">
          <option value="ALL">All Sections</option>
          <option value="A">Sec A</option>
          <option value="B">Sec B</option>
        </select>
        <select value={residenceType} onChange={(e) => { setResidenceType(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs">
          <option value="ALL">Residence</option>
          <option value="Day Scholar">Day Scholar</option>
          <option value="Hostel">Hostel</option>
        </select>
        <select value={examStatus} onChange={(e) => { setExamStatus(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs">
          <option value="ALL">Exam Status</option>
          <option value="Eligible">Eligible</option>
          <option value="Attendance Review">Attendance Review</option>
        </select>
        <select value={cgpaAvail} onChange={(e) => { setCgpaAvail(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs">
          <option value="ALL">CGPA Filter</option>
          <option value="YES">CGPA Available</option>
          <option value="NO">Not Available (NULL)</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">USN</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Dept / Sem</th>
                <th className="px-4 py-3">Att %</th>
                <th className="px-4 py-3">CGPA</th>
                <th className="px-4 py-3">Room / Lab</th>
                <th className="px-4 py-3">Residence</th>
                <th className="px-4 py-3">Exam / Placement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={9} className="p-6 text-center text-slate-500">Loading students...</td></tr>
              ) : (data?.items || []).map((s: StudentRecord) => (
                <tr
                  key={s.student_id}
                  onClick={() => setSelectedId(s.student_id)}
                  className="cursor-pointer transition hover:bg-blue-50/50"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-[#2563EB]">{s.student_id}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{s.usn}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{s.student_name}</td>
                  <td className="px-4 py-2.5">{s.department} · S{s.semester}-{s.section}</td>
                  <td className="px-4 py-2.5 font-semibold">{s.attendance_percent}%</td>
                  <td className="px-4 py-2.5">
                    {s.cgpa !== null ? s.cgpa : <span className="italic text-slate-400">Not Available</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">{s.classroom_id} / {s.lab_id}</td>
                  <td className="px-4 py-2.5">
                    {s.residence_type} {s.hostel_room ? `(${s.hostel_room})` : s.bus_route ? `(${s.bus_route})` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={s.exam_status === "Eligible" ? "Operational" : "Warning"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
          <span>Showing {data?.items?.length || 0} of {data?.total || 0} matching students</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {data?.total_pages || 1}</span>
            <button
              disabled={page >= (data?.total_pages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Student Profile & Dependency Drawer */}
      {selectedId && detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="font-mono text-xs font-semibold text-[#2563EB]">{detail.student_id} · {detail.usn}</p>
                <h2 className="font-display text-xl font-bold text-slate-900">{detail.student_name}</h2>
                <p className="text-xs text-slate-500">
                  {detail.department} • Semester {detail.semester} • Section {detail.section}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Attendance</span>
                <p className="text-base font-bold text-slate-900">{detail.attendance_percent}%</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">CGPA</span>
                <p className="text-base font-bold text-slate-900">{detail.cgpa !== null ? detail.cgpa : "Not Available"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Classroom / Lab</span>
                <p className="font-mono font-semibold text-slate-900">{detail.classroom_id} · {detail.lab_id}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Mentor (Advisory)</span>
                <p className="font-mono font-semibold text-slate-900">{detail.mentor_id}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Residence / Commute</span>
                <p className="font-semibold text-slate-900">
                  {detail.residence_type} • {detail.hostel_room || detail.bus_route || "Not Available"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-500">Email</span>
                <p className="truncate font-medium text-slate-900">{detail.email || "Protected (Evaluator Role)"}</p>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-display text-sm font-bold text-slate-900">Institutional Dependency Network</h3>
              <p className="text-[11px] text-slate-500">Mandatory operational links vs advisory mentor association</p>
              <div className="mt-2 space-y-1.5">
                {(deps?.links || []).map((l: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <span className="font-mono font-semibold text-slate-800">{l.source} → {l.target}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.is_mandatory ? "bg-cyan-50 text-cyan-800" : "bg-slate-100 text-slate-600"}`}>
                      {l.relation}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-display text-sm font-bold text-slate-900">Simulation & Incident Impact History</h3>
              {(incidents?.simulation_impacts || []).length ? (
                <div className="mt-2 space-y-2">
                  {incidents.simulation_impacts.map((imp: any) => (
                    <div key={imp.simulation_id} className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs">
                      <p className="font-semibold text-red-900">{imp.scenario_name}</p>
                      <p className="mt-1 text-red-700">{imp.impact_reasons.join(" · ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No simulated disruptions have impacted this student in the current session.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
