import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert, Sliders, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { SectionHeader, StatusBadge } from "../components/ui/Primitives";

export function RecoveryOptimizerPage() {
  const queryClient = useQueryClient();
  const {
    activeSimulation,
    setActiveSimulation,
    recoveryPlans,
    setRecoveryPlans,
    appliedPlanId,
    setAppliedPlanId,
    role,
  } = useTwin();

  const [maxBudget, setMaxBudget] = useState<string>("");
  const [maxDuration, setMaxDuration] = useState<string>("");
  const [solving, setSolving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSolve = async () => {
    if (!activeSimulation) return;
    setSolving(true);
    setFeedback(null);
    try {
      const res = await api.optimizeRecovery({
        simulation_id: activeSimulation.simulation_id,
        max_budget: maxBudget ? Number(maxBudget) : undefined,
        max_duration_minutes: maxDuration ? Number(maxDuration) : undefined,
      });
      setRecoveryPlans(res.plans);
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setSolving(false);
    }
  };

  const handleApply = async (planId: string) => {
    setFeedback(null);
    try {
      const res = await api.applyRecovery({
        plan_id: planId,
        simulation_id: activeSimulation?.simulation_id,
        approver_name: `Administrator (${role})`,
      });
      setAppliedPlanId(planId);
      if (res.simulation) {
        setActiveSimulation(res.simulation);
      }
      setFeedback(res.message);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["campus"] });
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const healthCompare = activeSimulation
    ? [
        { stage: "Before Failure", score: activeSimulation.baseline_health.overall_score },
        { stage: "After Failure", score: activeSimulation.post_failure_health.overall_score },
        ...recoveryPlans.map((p) => ({
          stage: `${p.plan_label} Recovery`,
          score: p.post_recovery_health,
        })),
      ]
    : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Constraint-Based Recovery Optimizer"
        subtitle="Google OR-Tools CP-SAT mathematical solver enforcing hard institutional constraints across 3 strategic trade-offs"
      />

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900">
          {feedback}
        </div>
      )}

      {/* Constraint Controls */}
      <div className="glass-card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]">
            <Sliders className="h-3.5 w-3.5" /> Max Budget Ceiling (₹ optional)
          </label>
          <input
            type="number"
            placeholder="No ceiling (or test e.g. 500)"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#64748B]">Max Recovery Duration (min optional)</label>
          <input
            type="number"
            placeholder="No limit (or test e.g. 3)"
            value={maxDuration}
            onChange={(e) => setMaxDuration(e.target.value)}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
          />
        </div>
        <button
          disabled={!activeSimulation || solving}
          onClick={handleSolve}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Wrench className="h-4 w-4" />
          {solving ? "Solving CP-SAT..." : "Re-Solve Recovery Plans"}
        </button>
        {!activeSimulation && (
          <span className="text-xs text-amber-700">Run a simulation or Operation Zero Failure first to optimize recovery.</span>
        )}
      </div>

      {/* 3 Plan Comparison Cards */}
      {recoveryPlans.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {recoveryPlans.map((plan) => (
              <div
                key={plan.plan_id}
                className={`glass-card flex flex-col justify-between p-5 ${
                  appliedPlanId === plan.plan_id ? "ring-2 ring-[#10B981]" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">{plan.plan_label}</span>
                      <h3 className="font-display text-base font-bold text-[#0F172A]">{plan.strategy_name}</h3>
                    </div>
                    <StatusBadge status={plan.solver_status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="text-slate-500">Students Restored</span>
                      <p className="font-bold text-slate-900">{plan.students_restored} / {plan.students_affected}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Remaining Disrupted</span>
                      <p className="font-bold text-slate-900">{plan.remaining_disruptions}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Duration</span>
                      <p className="font-bold text-slate-900">{plan.estimated_duration_minutes} min</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Synthetic Cost</span>
                      <p className="font-bold text-slate-900">₹{plan.estimated_cost.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">{plan.explanation}</p>

                  {!plan.constraints_satisfied && plan.blocking_constraints.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                      <p className="flex items-center gap-1 font-bold"><ShieldAlert className="h-3.5 w-3.5" /> Blocking Constraints</p>
                      <ul className="mt-1 list-disc pl-4">
                        {plan.blocking_constraints.map((bc, idx) => <li key={idx}>{bc}</li>)}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-800">Selected Recovery Actions ({plan.actions.length})</p>
                    <div className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto">
                      {plan.actions.map((a) => (
                        <div key={a.action_id} className="rounded-lg border border-slate-200 bg-white p-2 text-[11px]">
                          <p className="font-semibold text-slate-900">
                            {a.target_resource_id} → {a.replacement_resource_id}
                          </p>
                          <p className="text-slate-500">{a.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  disabled={!plan.constraints_satisfied || appliedPlanId === plan.plan_id}
                  onClick={() => handleApply(plan.plan_id)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {appliedPlanId === plan.plan_id ? "Applied to Institution" : "Approve & Apply Plan"}
                </button>
              </div>
            ))}
          </div>

          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">Institutional Health Comparison (Before vs Failure vs Recovery)</h3>
            <div className="mt-3 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthCompare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
