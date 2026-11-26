# OMNIS-X — Operation Zero Failure Demonstration Script (3 Minutes)

## Minute 0:00 – 0:45 | Institutional Baseline & 3D Digital Twin
1. Open the **Overview** dashboard (`http://127.0.0.1:5173`).
2. Highlight the **200 authoritative students** loaded from `omnis_x_200_students(1).csv` (with `50` missing CGPAs preserved as `Not Available`, never `0`).
3. Rotate the **3D Campus** and click `BLDG-POWER` and `BLDG-CSE` to show mapped institutional resource IDs (`PWR-ACAD-A`, `LAB-CSE-1`, `LAB-CSE-2`).

## Minute 0:45 – 1:45 | Operation Zero Failure (Cascading Failure Simulation)
1. Click **Operation Zero Failure** in the top navigation bar.
2. Watch the **Simulation Lab** animate the deterministic NetworkX cascade:
   - `T+0m`: `PWR-ACAD-A` substation enters **Critical** state (red).
   - `T+1m–2m`: `LAB-CSE-1`, `LAB-CSE-2`, `LAB-ISE-1`, `LAB-ISE-2`, `NET-CORE`, `NET-EXAM` propagate into **Disrupted** state.
   - `T+3m`: `HALL-EXAM-1`, `HALL-EXAM-2`, and scheduled online assessments (`EXM-CSE-5`, `EXM-ISE-7`) cascade.
3. Point to the **deduplicated affected student count** and the dynamic drop in the **Institutional Health Index**.

## Minute 1:45 – 2:35 | Google OR-Tools CP-SAT Recovery Optimizer
1. Navigate to **Recovery Optimizer**.
2. Compare **Plan A (Minimum Academic Disruption)**, **Plan B (Minimum Operational Cost)**, and **Plan C (Fastest Recovery)** — noting exact CP-SAT solver status (`OPTIMAL`/`FEASIBLE`), action rationales (e.g., `GEN-01` diesel backup, `HALL-SEMINAR` relocation), and post-recovery health rebound.
3. Optionally enter an impossible budget ceiling (e.g. `50`) and click **Re-Solve** to prove honest `INFEASIBLE` reporting with blocking constraints.

## Minute 2:35 – 3:00 | Proactive Risk Radar & Governance
1. Clear the budget ceiling, re-solve, and click **Approve & Apply Plan**.
2. Open **Risk Intelligence** to highlight Single Points of Failure (`NET-EXAM`, `WTR-HOSTEL`) and ask the **Local Operational Assistant** a live query.
3. Switch the header role to **Evaluator (Read-Only)** and open **Students** to show email protection and least-privilege access.
