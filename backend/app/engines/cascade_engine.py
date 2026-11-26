"""Deterministic Event-Driven Cascading Failure Simulation Engine (NetworkX).

Produces reproducible, baseline-isolated simulation timelines, resource states,
deduplicated affected student IDs (from the authoritative 200-student dataset),
affected faculty, affected buildings for 3D visualization, and health impact.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import heapq
from typing import Any, Dict, List, Set, Tuple
import uuid
import networkx as nx

from app.engines.conflict_engine import detect_all_conflicts
from app.engines.dependency_engine import build_dependency_graph
from app.engines.health_engine import compute_institutional_health

SEVERITY_FACTOR = {"Critical": 1.0, "High": 0.85, "Medium": 0.65, "Low": 0.40}

INCIDENT_TYPE_ALIASES: Dict[str, str] = {
    "lab_failure": "laboratory_failure",
    "faculty_unavailability": "faculty_absence",
}

INCIDENT_COMPATIBLE_TYPES: Dict[str, Set[str]] = {
    "electricity_failure": {"Power", "BackupGenerator"},
    "internet_outage": {"Network"},
    "laboratory_failure": {"Laboratory"},
    "classroom_unavailability": {"Classroom"},
    "faculty_absence": {"Faculty"},
    "bus_breakdown": {"BusRoute"},
    "driver_unavailability": {"Driver"},
    "hostel_water_failure": {"Water", "HostelBlock"},
    "exam_hall_failure": {"ExamHall", "Examination"},
    "placement_venue_failure": {"Venue", "PlacementDrive"},
    "event_venue_failure": {"Venue", "Event"},
}


class ResourceNotFoundError(ValueError):
    """Raised when the target resource ID does not exist in the dependency graph."""


class ResourceCompatibilityError(ValueError):
    """Raised when incident_type is unknown or incompatible with target resource_type."""


def canonicalize_incident_type(incident_type: str) -> str:
    normalized = incident_type.strip().lower()
    return INCIDENT_TYPE_ALIASES.get(normalized, normalized)


def validate_incident_resource(
    g: nx.DiGraph,
    incident_type: str,
    root_resource_id: str,
) -> Tuple[str, str]:
    """Validate that root_resource_id exists and is compatible with incident_type."""
    canonical_type = canonicalize_incident_type(incident_type)
    if canonical_type not in INCIDENT_COMPATIBLE_TYPES:
        valid_types = ", ".join(sorted(INCIDENT_COMPATIBLE_TYPES.keys()))
        raise ResourceCompatibilityError(
            f"Unsupported incident_type '{incident_type}'. Supported types: {valid_types}."
        )
    if root_resource_id not in g:
        raise ResourceNotFoundError(
            f"Resource '{root_resource_id}' not found in institutional dependency graph."
        )
    resource_type = g.nodes[root_resource_id].get("resource_type", "Resource")
    allowed = INCIDENT_COMPATIBLE_TYPES[canonical_type]
    if resource_type not in allowed:
        raise ResourceCompatibilityError(
            f"Target resource '{root_resource_id}' (type '{resource_type}') is incompatible with "
            f"incident '{canonical_type}'. Expected resource types: {', '.join(sorted(allowed))}."
        )
    return canonical_type, resource_type


def _find_affected_students_and_faculty(
    snapshot: Dict[str, Any],
    disrupted_ids: Set[str],
    incident_type: str,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Map disrupted resources strictly to actual students (deduplicated) and faculty."""
    students = snapshot.get("students", [])
    timetable = snapshot.get("timetable", [])
    examinations = snapshot.get("examinations", [])
    hostel_rooms = snapshot.get("hostel_rooms", [])
    placement_drives = snapshot.get("placement_drives", [])

    # Build group -> student mapping
    group_to_students: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for s in students:
        grp = f"GRP-{s['department']}-{s['semester']}-{s['section']}"
        group_to_students[grp].append(s)

    reasons_by_student: Dict[str, List[str]] = defaultdict(list)
    affected_faculty: Set[str] = set()

    # 1. Direct classroom / lab disruption -> students assigned + scheduled sessions
    for s in students:
        if s["classroom_id"] in disrupted_ids:
            reasons_by_student[s["student_id"]].append(f"Primary classroom {s['classroom_id']} disrupted")
        if s["lab_id"] in disrupted_ids:
            reasons_by_student[s["student_id"]].append(f"Assigned laboratory {s['lab_id']} unavailable")
        if s.get("bus_route") and s["bus_route"] != "Self" and s["bus_route"] in disrupted_ids:
            reasons_by_student[s["student_id"]].append(f"Bus route {s['bus_route']} disrupted (commute risk)")

    # 2. Hostel blocks / water / power -> ONLY hostel residents in affected blocks
    room_to_block = {r["room_id"]: r["block_id"] for r in hostel_rooms}
    for s in students:
        if s["residence_type"] == "Hostel" and s.get("hostel_room"):
            blk = room_to_block.get(s["hostel_room"])
            if blk and blk in disrupted_ids:
                reasons_by_student[s["student_id"]].append(f"Hostel block {blk} utility disruption (Room {s['hostel_room']})")

    # 3. Timetable sessions & AcademicGroups disrupted
    for sess in timetable:
        if (
            sess["session_id"] in disrupted_ids
            or sess["room_id"] in disrupted_ids
            or sess["faculty_id"] in disrupted_ids
        ):
            affected_faculty.add(sess["faculty_id"])
            for s in group_to_students.get(sess["academic_group_id"], []):
                reasons_by_student[s["student_id"]].append(
                    f"Academic session {sess['session_id']} ({sess['subject_code']}) affected"
                )

    for grp_id, grp_students in group_to_students.items():
        if grp_id in disrupted_ids:
            for s in grp_students:
                reasons_by_student[s["student_id"]].append(f"Academic group {grp_id} schedule disrupted")

    # 4. Examinations disrupted
    for exam in examinations:
        if (
            exam["exam_id"] in disrupted_ids
            or exam["hall_id"] in disrupted_ids
            or exam["invigilator_id"] in disrupted_ids
        ):
            affected_faculty.add(exam["invigilator_id"])
            for s in students:
                if s["department"] == exam["department"] and s["semester"] == exam["semester"]:
                    reasons_by_student[s["student_id"]].append(
                        f"Examination {exam['exam_id']} ({exam['exam_mode']}) impacted"
                    )

    # 5. Placement drives disrupted
    for drive in placement_drives:
        if drive["drive_id"] in disrupted_ids or drive["venue_id"] in disrupted_ids:
            for s in students:
                if (
                    s["department"] in drive["eligible_departments"]
                    and s["semester"] == drive["eligible_semester"]
                    and s["placement_status"] in ("Registered", "Placed")
                ):
                    reasons_by_student[s["student_id"]].append(
                        f"Placement drive {drive['drive_id']} ({drive['company_name']}) impacted"
                    )

    # 6. Faculty directly disrupted
    for fac in snapshot.get("faculty", []):
        if fac["faculty_id"] in disrupted_ids:
            affected_faculty.add(fac["faculty_id"])

    # Deduplicated affected student list (never invent students, never count twice)
    stu_map = {s["student_id"]: s for s in students}
    affected_students = []
    for sid in sorted(reasons_by_student.keys()):
        st = stu_map[sid]
        affected_students.append(
            {
                "student_id": sid,
                "usn": st["usn"],
                "student_name": st["student_name"],
                "department": st["department"],
                "semester": st["semester"],
                "section": st["section"],
                "classroom_id": st["classroom_id"],
                "lab_id": st["lab_id"],
                "residence_type": st["residence_type"],
                "bus_route": st.get("bus_route"),
                "impact_reasons": sorted(set(reasons_by_student[sid])),
            }
        )

    return affected_students, sorted(affected_faculty)


def run_cascading_simulation(
    snapshot: Dict[str, Any],
    incident_type: str,
    root_resource_id: str,
    severity: str = "Critical",
    duration_minutes: int = 120,
    horizon_minutes: int = 180,
    use_backups: bool = True,
    scenario_name: str = "Institutional Failure Simulation",
    health_weights: Dict[str, float] | None = None,
    recovery_priority: str = "academic_continuity",
) -> Dict[str, Any]:
    """Execute deterministic event-driven cascading simulation over an isolated snapshot."""
    g: nx.DiGraph = build_dependency_graph(snapshot)
    canonical_incident, root_resource_type = validate_incident_resource(
        g, incident_type, root_resource_id
    )

    baseline_conflicts = detect_all_conflicts(snapshot)
    baseline_health = compute_institutional_health(
        snapshot, baseline_conflicts, weights=health_weights, context_label="baseline"
    )

    sev_mult = SEVERITY_FACTOR.get(severity, 0.85)
    backup_map = {
        b["primary_resource_id"]: b
        for b in snapshot.get("backup_resources", [])
        if b.get("availability_status") == "Available" and b.get("primary_resource_id")
    }

    # Priority queue for deterministic chronological propagation: (minute_offset, hop_depth, node_id, cause)
    pq: List[Tuple[int, int, str, str]] = []
    heapq.heappush(
        pq,
        (0, 0, root_resource_id, f"Initial {severity} {incident_type.replace('_', ' ')} triggered at {root_resource_id}."),
    )

    visited: Set[str] = set()
    timeline_events: List[Dict[str, Any]] = []
    resource_states: Dict[str, Dict[str, Any]] = {}
    downstream_risks: List[Dict[str, Any]] = []
    step_counter = 0

    while pq:
        minute, hop, node_id, cause = heapq.heappop(pq)
        if node_id in visited or minute > horizon_minutes:
            continue
        visited.add(node_id)

        ndata = g.nodes[node_id]
        rtype = ndata.get("resource_type", "Resource")

        # Check if an active backup buffers this node
        backup_applied = None
        if use_backups and node_id in backup_map:
            bkp = backup_map[node_id]
            # Power generators keep critical power running after transfer delay; secondary assets suffer brief Warning
            if rtype in ("Power", "Network") and severity != "Critical":
                backup_applied = bkp
                new_state = "Warning"
            elif rtype in ("Power", "Network") and hop == 0 and bkp["activation_minutes"] <= 10:
                # Even on Critical root failure, backup partially cushions downstream non-mandatory loads,
                # though root remains Disrupted/Critical until recovery plan executes.
                new_state = "Critical" if severity == "Critical" else "Disrupted"
            else:
                new_state = "Critical" if hop == 0 and severity == "Critical" else "Disrupted"
        else:
            if hop == 0 and severity == "Critical":
                new_state = "Critical"
            elif hop <= 1 and sev_mult >= 0.65:
                new_state = "Disrupted"
            else:
                new_state = "Warning" if sev_mult < 0.65 else "Disrupted"

        failure_level = "Primary" if hop == 0 else ("Secondary" if hop == 1 else "Tertiary")
        step_counter += 1
        timeline_events.append(
            {
                "step_order": step_counter,
                "minute_offset": minute,
                "resource_id": node_id,
                "resource_name": ndata.get("resource_name", node_id),
                "resource_type": rtype,
                "building_id": ndata.get("building_id", "BLDG-ADMIN"),
                "previous_state": ndata.get("operational_status", "Operational"),
                "new_state": new_state,
                "failure_level": failure_level,
                "cause_description": cause,
            }
        )

        resource_states[node_id] = {
            "resource_id": node_id,
            "resource_name": ndata.get("resource_name", node_id),
            "resource_type": rtype,
            "department": ndata.get("department", "INST"),
            "building_id": ndata.get("building_id", "BLDG-ADMIN"),
            "state": new_state,
            "failure_level": failure_level,
            "minute_offset": minute,
            "impact_score": round(ndata.get("criticality", 70) * sev_mult / (1 + 0.15 * hop), 2),
        }

        # Propagate along outgoing dependency edges
        for neighbor in sorted(g.successors(node_id)):
            if neighbor in visited:
                continue
            edata = g.get_edge_data(node_id, neighbor)
            is_mandatory = edata.get("is_mandatory", True)
            strength = float(edata.get("dependency_strength", 0.8))
            delay = int(edata.get("propagation_delay_minutes", 5))
            next_minute = minute + delay

            # Backup mitigation reduces effective coupling strength on buffered infrastructure edges
            effective_strength = strength * sev_mult
            if use_backups and node_id in backup_map and edata.get("alternative_dependency"):
                effective_strength *= 0.55

            if is_mandatory and effective_strength >= 0.40 and next_minute <= duration_minutes + 60:
                heapq.heappush(
                    pq,
                    (
                        next_minute,
                        hop + 1,
                        neighbor,
                        f"Propagated from {node_id} via {edata.get('dependency_type')} (strength {strength:.2f}, delay {delay}m).",
                    ),
                )
            else:
                downstream_risks.append(
                    {
                        "resource_id": neighbor,
                        "resource_name": g.nodes[neighbor].get("resource_name", neighbor),
                        "resource_type": g.nodes[neighbor].get("resource_type", "Resource"),
                        "cause": f"Optional/buffered dependency on {node_id} (effective coupling {effective_strength:.2f})",
                    }
                )

    disrupted_ids = {
        rid for rid, st in resource_states.items() if st["state"] in ("Critical", "Disrupted")
    }
    affected_students, affected_faculty = _find_affected_students_and_faculty(
        snapshot, disrupted_ids, incident_type
    )

    post_failure_health = compute_institutional_health(
        snapshot,
        baseline_conflicts,
        weights=health_weights,
        disrupted_resource_ids=disrupted_ids,
        affected_student_count=len(affected_students),
        context_label="post_failure",
    )

    # Aggregate 3D building statuses
    building_status: Dict[str, str] = {}
    priority_rank = {"Critical": 4, "Disrupted": 3, "Warning": 2, "Recovering": 1, "Operational": 0}
    for st in resource_states.values():
        bid = st.get("building_id")
        if not bid:
            continue
        cur = building_status.get(bid, "Operational")
        if priority_rank.get(st["state"], 0) > priority_rank.get(cur, 0):
            building_status[bid] = st["state"]

    # Highlight propagation edges traversed
    propagation_edges = [
        {"source": u, "target": v, "dependency_type": d.get("dependency_type")}
        for u, v, d in g.edges(data=True)
        if u in visited and v in visited
    ]

    sim_id = str(uuid.uuid4())
    return {
        "simulation_id": sim_id,
        "scenario_name": scenario_name,
        "incident_type": canonical_incident,
        "root_resource_id": root_resource_id,
        "root_resource_name": g.nodes[root_resource_id].get("resource_name", root_resource_id),
        "root_resource_type": root_resource_type,
        "severity": severity,
        "duration_minutes": duration_minutes,
        "horizon_minutes": horizon_minutes,
        "use_backups": use_backups,
        "recovery_priority": recovery_priority,
        "status": "Completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "baseline_health": baseline_health,
        "post_failure_health": post_failure_health,
        "post_recovery_health": None,
        "applied_plan_id": None,
        "restored_resource_ids": [],
        "students_restored_count": 0,
        "health_drop": round(baseline_health["overall_score"] - post_failure_health["overall_score"], 2),
        "direct_failures": [r for r in resource_states.values() if r["failure_level"] == "Primary"],
        "indirect_failures": [r for r in resource_states.values() if r["failure_level"] != "Primary"],
        "downstream_risks": downstream_risks[:20],
        "affected_resources": list(resource_states.values()),
        "affected_students": affected_students,
        "affected_student_count": len(affected_students),
        "currently_affected_students": affected_students,
        "currently_affected_student_count": len(affected_students),
        "affected_faculty": affected_faculty,
        "building_statuses": building_status,
        "propagation_edges": propagation_edges,
        "timeline_events": timeline_events,
    }
