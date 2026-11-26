import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { SectionHeader, StatusBadge } from "../components/ui/Primitives";

export function ConflictCentrePage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["conflicts"], queryFn: api.getConflicts });
  const [detecting, setDetecting] = useState(false);

  const handleScan = async () => {
    setDetecting(true);
    try {
      await api.detectConflicts();
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Intelligent Conflict Centre"
        subtitle="Rule-based validation across timetables, labs, exam halls, placement drives, events, transport, and infrastructure"
        right={
          <button onClick={handleScan} disabled={detecting} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white">
            <RefreshCw className={`h-4 w-4 ${detecting ? "animate-spin" : ""}`} />
            Run Conflict Scan
          </button>
        }
      />

      <div className="space-y-3">
        {(data?.items || []).map((c) => (
          <div key={c.conflict_id} className="glass-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-mono text-xs font-bold text-slate-500">{c.conflict_id}</span>
                <h3 className="font-display text-sm font-bold text-slate-900">{c.conflict_category}</h3>
              </div>
              <StatusBadge status={c.severity} />
            </div>
            <p className="mt-2 text-xs text-slate-700">{c.root_cause}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs md:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-500">Operational Impact:</span>
                <p className="text-slate-800">{c.operational_impact}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Suggested Resolution:</span>
                <p className="text-emerald-800">{c.suggested_resolution}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {c.affected_resource_ids.map((r) => (
                <span key={r} className="rounded bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">{r}</span>
              ))}
              {c.affected_student_ids.length > 0 && (
                <span className="rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                  {c.affected_student_ids.length} Affected Students
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskIntelligencePage() {
  const { activeSimulation } = useTwin();
  const { data: risk } = useQuery({ queryKey: ["risk-analysis"], queryFn: api.getRiskAnalysis });
  const [question, setQuestion] = useState("Which resource is the most critical?");
  const [answer, setAnswer] = useState<any | null>(null);

  const handleAsk = async () => {
    const res = await api.queryAssistant(question, activeSimulation?.simulation_id);
    setAnswer(res);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Proactive Risk Intelligence & SPOF Radar"
        subtitle="NetworkX graph centrality analysis & redundancy assessment (model-based operational estimates)"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="glass-card p-4">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#0F172A]">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Single Point of Failure (SPOF) Radar
          </h3>
          <div className="mt-3 space-y-2.5">
            {(risk?.single_points_of_failure || []).map((r: any) => (
              <div key={r.resource_id} className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{r.resource_name} ({r.resource_id})</span>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-bold text-red-800">Risk {r.risk_score}/100</span>
                </div>
                <p className="mt-1 text-slate-600">{r.preventive_recommendation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Local Intelligent Assistant */}
        <div className="glass-card flex flex-col justify-between p-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#0F172A]">
              <Bot className="h-4 w-4 text-[#7C3AED]" />
              Local Operational Assistant (Database-Grounded)
            </h3>
            <p className="mt-1 text-xs text-[#64748B]">
              Answers queries directly from the 200-student CSV, NetworkX dependency graph, and active simulation state.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "Which students depend on LAB-CSE-1?",
                "What happens if BUS-01 breaks down?",
                "Why did the institutional health score change?",
                "Which recovery plan minimizes student disruption?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-blue-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {answer && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-xs">
                <p className="font-semibold text-slate-900">{answer.answer}</p>
                <p className="mt-1 text-[10px] font-medium text-violet-700">Source: {answer.source}</p>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                placeholder="Ask an operational question..."
              />
              <button onClick={handleAsk} className="inline-flex items-center gap-1 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white">
                <Send className="h-3.5 w-3.5" /> Ask
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Resource Ranking Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-display text-sm font-bold text-[#0F172A]">NetworkX Criticality & Betweenness Centrality Ranking</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Resource ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Dependents</th>
                <th className="px-4 py-2.5">Centrality</th>
                <th className="px-4 py-2.5">Backup</th>
                <th className="px-4 py-2.5">Risk Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(risk?.top_critical_resources || []).map((r: any) => (
                <tr key={r.resource_id}>
                  <td className="px-4 py-2 font-mono font-semibold text-[#2563EB]">{r.resource_id}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{r.resource_name}</td>
                  <td className="px-4 py-2">{r.resource_type}</td>
                  <td className="px-4 py-2 font-semibold">{r.downstream_dependents}</td>
                  <td className="px-4 py-2 font-mono">{r.betweenness_centrality}</td>
                  <td className="px-4 py-2">{r.backup_resource || <span className="text-red-600">None (SPOF)</span>}</td>
                  <td className="px-4 py-2 font-bold">{r.risk_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
