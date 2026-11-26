"""Proactive Risk Intelligence & Single-Point-of-Failure Radar Engine."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List
import networkx as nx


def analyze_institutional_risk(snapshot: Dict[str, Any], g: nx.DiGraph, conflicts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute NetworkX centrality, SPOF radar, department risk heatmap, and preventive guidance."""
    betweenness = nx.betweenness_centrality(g, normalized=True) if g.number_of_nodes() > 0 else {}
    backup_targets = {b.get("primary_resource_id") for b in snapshot.get("backup_resources", []) if b.get("availability_status") == "Available"}

    critical_resources: List[Dict[str, Any]] = []
    spof_list: List[Dict[str, Any]] = []

    for nid, data in g.nodes(data=True):
        rtype = data.get("resource_type", "Unknown")
        if rtype in ("AcademicGroup", "AcademicSession"):
            continue
        descendants = nx.descendants(g, nid)
        out_deg = g.out_degree(nid)
        cent = round(float(betweenness.get(nid, 0.0)), 4)
        has_backup = bool(data.get("backup_resource")) or (nid in backup_targets)
        base_crit = float(data.get("criticality", 60))

        # Model-based risk score combining criticality, downstream reach, centrality, and lack of backup
        risk_score = min(
            100.0,
            round(
                0.45 * base_crit
                + 0.30 * min(len(descendants) * 3.5, 100.0)
                + 0.15 * min(cent * 400.0, 100.0)
                + (15.0 if not has_backup else 0.0),
                2,
            ),
        )
        is_spof = (not has_backup) and (len(descendants) >= 2 or base_crit >= 85)

        recommendation = (
            f"Provision automated backup for {data.get('resource_name', nid)} ({len(descendants)} downstream dependents)."
            if is_spof
            else f"Maintain scheduled preventive health checks and verify failover readiness ({data.get('backup_resource') or 'backup pool'})."
        )

        entry = {
            "resource_id": nid,
            "resource_name": data.get("resource_name", nid),
            "resource_type": rtype,
            "department": data.get("department", "INST"),
            "operational_status": data.get("operational_status", "Operational"),
            "betweenness_centrality": cent,
            "out_degree": out_deg,
            "downstream_dependents": len(descendants),
            "has_backup": has_backup,
            "backup_resource": data.get("backup_resource"),
            "is_spof": is_spof,
            "risk_score": risk_score,
            "preventive_recommendation": recommendation,
            "is_model_estimate": True,
        }
        critical_resources.append(entry)
        if is_spof:
            spof_list.append(entry)

    critical_resources.sort(key=lambda x: x["risk_score"], reverse=True)
    spof_list.sort(key=lambda x: x["risk_score"], reverse=True)

    # Department-wise risk heatmap
    dept_scores = defaultdict(list)
    dept_students = defaultdict(int)
    for s in snapshot.get("students", []):
        dept_students[s["department"]] += 1

    for item in critical_resources:
        dept = item["department"]
        if dept in dept_students:
            dept_scores[dept].append(item["risk_score"])

    dept_conflicts = defaultdict(int)
    for c in conflicts:
        for rid in c.get("affected_resource_ids", []):
            for dept in dept_students:
                if f"-{dept}-" in rid or rid.endswith(f"-{dept}"):
                    dept_conflicts[dept] += 1

    department_risk = []
    for dept in sorted(dept_students.keys()):
        scores = dept_scores.get(dept, [45.0])
        avg_risk = round(sum(scores) / len(scores), 2)
        max_risk = round(max(scores), 2)
        department_risk.append(
            {
                "department": dept,
                "student_count": dept_students[dept],
                "average_risk_score": avg_risk,
                "peak_risk_score": max_risk,
                "open_conflicts": dept_conflicts[dept],
                "risk_level": "High" if avg_risk >= 65 else ("Medium" if avg_risk >= 45 else "Low"),
            }
        )

    return {
        "top_critical_resources": critical_resources[:12],
        "single_points_of_failure": spof_list[:10],
        "department_risk_heatmap": department_risk,
        "redundancy_summary": {
            "total_evaluated_resources": len(critical_resources),
            "with_backup": sum(1 for r in critical_resources if r["has_backup"]),
            "without_backup_spof": len(spof_list),
        },
        "is_model_estimate": True,
    }
