import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StatusBadge } from "../components/ui/Primitives";

const TYPE_COLOR: Record<string, { bg: string; border: string }> = {
  Power: { bg: "#FEF3C7", border: "#F59E0B" },
  BackupGenerator: { bg: "#ECFDF5", border: "#10B981" },
  Network: { bg: "#ECFEFF", border: "#06B6D4" },
  Water: { bg: "#EFF6FF", border: "#2563EB" },
  Laboratory: { bg: "#F5F3FF", border: "#7C3AED" },
  Classroom: { bg: "#F8FAFC", border: "#64748B" },
  ExamHall: { bg: "#FEF2F2", border: "#EF4444" },
  Examination: { bg: "#FEE2E2", border: "#DC2626" },
  HostelBlock: { bg: "#F0FDF4", border: "#16A34A" },
  BusRoute: { bg: "#EFF6FF", border: "#3B82F6" },
  Faculty: { bg: "#F1F5F9", border: "#475569" },
};

const TIER_X: Record<string, number> = {
  Power: 40,
  BackupGenerator: 40,
  Water: 40,
  Driver: 40,
  Network: 280,
  Laboratory: 540,
  Classroom: 540,
  ExamHall: 540,
  HostelBlock: 540,
  BusRoute: 540,
  Faculty: 540,
  Venue: 540,
  AcademicSession: 820,
  Examination: 820,
  PlacementDrive: 820,
  Event: 820,
  AcademicGroup: 1080,
};

export function DependencyGraphFlow({
  graphData,
  disruptedIds = new Set<string>(),
  heightClass = "h-[520px]",
}: {
  graphData: { nodes: any[]; edges: any[] } | undefined;
  disruptedIds?: Set<string>;
  heightClass?: string;
}) {
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const { flowNodes, flowEdges, directDeps } = useMemo(() => {
    const rawNodes = graphData?.nodes || [];
    const rawEdges = graphData?.edges || [];

    const filteredNodes = rawNodes.filter((n) => {
      if (deptFilter !== "ALL" && n.department !== deptFilter && n.department !== "INFRA") return false;
      if (typeFilter !== "ALL" && n.resource_type !== typeFilter) return false;
      const effStatus = disruptedIds.has(n.id) ? "Disrupted" : n.operational_status;
      if (statusFilter !== "ALL" && effStatus !== statusFilter) return false;
      return true;
    });

    // Limit overwhelming academic session nodes in overview unless filtered
    const displayNodes = filteredNodes.slice(0, 85);
    const displaySet = new Set(displayNodes.map((n) => n.id));
    const tierCounters: Record<number, number> = {};

    const nodes: Node[] = displayNodes.map((n) => {
      const x = TIER_X[n.resource_type] ?? 650;
      const idx = tierCounters[x] || 0;
      tierCounters[x] = idx + 1;
      const y = 30 + idx * 72;
      const isDown = disruptedIds.has(n.id);
      const colors = isDown
        ? { bg: "#FEE2E2", border: "#EF4444" }
        : TYPE_COLOR[n.resource_type] || { bg: "#FFFFFF", border: "#CBD5E1" };

      return {
        id: n.id,
        position: { x, y },
        data: {
          label: (
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {n.resource_type}
              </div>
              <div className="truncate text-xs font-semibold text-slate-900">{n.id}</div>
            </div>
          ),
          raw: n,
        },
        style: {
          background: colors.bg,
          border: `2px solid ${selectedNode?.id === n.id ? "#2563EB" : colors.border}`,
          borderRadius: 10,
          padding: "6px 10px",
          width: 170,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
        },
      };
    });

    const edges: Edge[] = rawEdges
      .filter((e) => displaySet.has(e.source) && displaySet.has(e.target))
      .map((e) => {
        const hot = disruptedIds.has(e.source) || disruptedIds.has(e.target);
        const related = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: hot || Boolean(related),
          label: related ? e.dependency_type : undefined,
          style: {
            stroke: hot ? "#EF4444" : related ? "#2563EB" : e.is_mandatory ? "#06B6D4" : "#94A3B8",
            strokeWidth: hot || related ? 2.4 : 1.3,
            strokeDasharray: e.is_mandatory ? undefined : "5 4",
          },
        };
      });

    const deps = selectedNode
      ? {
          upstream: rawEdges.filter((e) => e.target === selectedNode.id).map((e) => e.source),
          downstream: rawEdges.filter((e) => e.source === selectedNode.id).map((e) => e.target),
        }
      : { upstream: [], downstream: [] };

    return { flowNodes: nodes, flowEdges: edges, directDeps: deps };
  }, [graphData, deptFilter, typeFilter, statusFilter, disruptedIds, selectedNode]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-3">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
        >
          <option value="ALL">All Departments</option>
          <option value="CSE">CSE</option>
          <option value="ISE">ISE</option>
          <option value="ECE">ECE</option>
          <option value="ME">ME</option>
          <option value="CV">CV</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
        >
          <option value="ALL">All Resource Types</option>
          <option value="Power">Power</option>
          <option value="Network">Network</option>
          <option value="Water">Water</option>
          <option value="Laboratory">Laboratory</option>
          <option value="Classroom">Classroom</option>
          <option value="ExamHall">ExamHall</option>
          <option value="Examination">Examination</option>
          <option value="HostelBlock">HostelBlock</option>
          <option value="BusRoute">BusRoute</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
        >
          <option value="ALL">All Statuses</option>
          <option value="Operational">Operational</option>
          <option value="Disrupted">Disrupted</option>
        </select>
        <span className="ml-auto text-xs text-[#64748B]">
          Showing {flowNodes.length} nodes & {flowEdges.length} dependency edges
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className={`lg:col-span-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] ${heightClass}`}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            onNodeClick={(_, node) => setSelectedNode((node.data as any).raw)}
          >
            <Background color="#CBD5E1" gap={18} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <div className="glass-card p-4">
          <h3 className="font-display text-sm font-bold text-[#0F172A]">Dependency Inspector</h3>
          {selectedNode ? (
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="font-semibold text-slate-900">{selectedNode.resource_name}</p>
                <p className="text-slate-500">
                  {selectedNode.id} • {selectedNode.resource_type}
                </p>
                <div className="mt-1.5">
                  <StatusBadge
                    status={disruptedIds.has(selectedNode.id) ? "Disrupted" : selectedNode.operational_status}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5">
                <div>
                  <span className="text-slate-500">Criticality</span>
                  <p className="font-bold text-slate-900">{selectedNode.criticality}/100</p>
                </div>
                <div>
                  <span className="text-slate-500">Backup</span>
                  <p className="font-bold text-slate-900">{selectedNode.backup_resource || "None"}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Upstream Inputs ({directDeps.upstream.length})</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {directDeps.upstream.length ? (
                    directDeps.upstream.map((u) => (
                      <span key={u} className="rounded bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-800">
                        {u}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Root resource</span>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Direct Dependents ({directDeps.downstream.length})</p>
                <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-auto">
                  {directDeps.downstream.length ? (
                    directDeps.downstream.map((d) => (
                      <span key={d} className="rounded bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                        {d}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Leaf activity</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#64748B]">
              Click any node in the NetworkX graph to inspect upstream inputs, downstream propagation targets, criticality, and backup redundancy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
