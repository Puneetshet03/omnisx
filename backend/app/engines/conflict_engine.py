"""Intelligent Rule-Based Conflict Detection Engine.

Detects scheduling, capacity, examination, placement, event, transportation,
hostel, and infrastructure conflicts strictly from verified schedules and
constraints (never inferring timetable clashes from classroom IDs alone).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List


def detect_all_conflicts(snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Run deterministic rule-based conflict checks across all institutional modules."""
    conflicts: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc).isoformat()
    students = snapshot.get("students", [])

    students_by_group = defaultdict(list)
    students_by_bus = defaultdict(list)
    students_by_hostel_room = defaultdict(list)
    for s in students:
        students_by_group[f"GRP-{s['department']}-{s['semester']}-{s['section']}"].append(s["student_id"])
        if s.get("bus_route") and s["bus_route"] != "Self":
            students_by_bus[s["bus_route"]].append(s["student_id"])
        if s.get("hostel_room"):
            students_by_hostel_room[s["hostel_room"]].append(s["student_id"])

    # 1. Timetable Room & Faculty Clashes (actual day_of_week + time_slot)
    room_slots = defaultdict(list)
    faculty_slots = defaultdict(list)
    group_slots = defaultdict(list)
    for sess in snapshot.get("timetable", []):
        room_slots[(sess["room_id"], sess["day_of_week"], sess["time_slot"])].append(sess)
        faculty_slots[(sess["faculty_id"], sess["day_of_week"], sess["time_slot"])].append(sess)
        group_slots[(sess["academic_group_id"], sess["day_of_week"], sess["time_slot"])].append(sess)

    for (room_id, day, slot), sessions in room_slots.items():
        if len(sessions) > 1:
            is_lab = room_id.startswith("LAB-")
            affected_stu = []
            for sess in sessions:
                affected_stu.extend(students_by_group.get(sess["academic_group_id"], []))
            affected_stu = sorted(set(affected_stu))
            conflicts.append(
                {
                    "conflict_id": f"CONF-ROOM-{room_id}-{day[:3].upper()}",
                    "conflict_category": "Laboratory Double Booking" if is_lab else "Classroom Double Booking",
                    "severity": "High" if is_lab else "Medium",
                    "root_cause": f"{room_id} is double-booked on {day} ({slot}) for {', '.join(s['session_id'] for s in sessions)}.",
                    "affected_resource_ids": [room_id] + [s["session_id"] for s in sessions],
                    "affected_student_ids": affected_stu,
                    "detection_timestamp": now,
                    "operational_impact": f"{len(sessions)} concurrent sessions scheduled in {room_id}, affecting {len(affected_stu)} students.",
                    "suggested_resolution": f"Reassign one session to an alternative {'laboratory' if is_lab else 'classroom'} or non-overlapping slot via Recovery Optimizer.",
                    "resolution_status": "Open",
                }
            )

    for (fac_id, day, slot), sessions in faculty_slots.items():
        if len(sessions) > 1:
            affected_stu = sorted({sid for s in sessions for sid in students_by_group.get(s["academic_group_id"], [])})
            conflicts.append(
                {
                    "conflict_id": f"CONF-FAC-{fac_id}-{day[:3].upper()}",
                    "conflict_category": "Faculty Timetable Clash",
                    "severity": "High",
                    "root_cause": f"Faculty {fac_id} assigned to {len(sessions)} overlapping sessions on {day} ({slot}).",
                    "affected_resource_ids": [fac_id] + [s["session_id"] for s in sessions],
                    "affected_student_ids": affected_stu,
                    "detection_timestamp": now,
                    "operational_impact": f"Instructional gap for {len(affected_stu)} students across overlapping sessions.",
                    "suggested_resolution": f"Assign a qualified substitute faculty from the same department or reschedule one session.",
                    "resolution_status": "Open",
                }
            )

    # 2. Placement & Examination Conflict (eligible semester/departments on same day/time)
    for exam in snapshot.get("examinations", []):
        for drive in snapshot.get("placement_drives", []):
            if (
                exam["day_of_week"] == drive["day_of_week"]
                and exam["department"] in drive["eligible_departments"]
                and exam["semester"] == drive["eligible_semester"]
            ):
                affected_stu = [
                    s["student_id"]
                    for s in students
                    if s["department"] == exam["department"]
                    and s["semester"] == exam["semester"]
                    and s["placement_status"] in ("Registered", "Placed")
                ]
                conflicts.append(
                    {
                        "conflict_id": f"CONF-PLC-EXM-{exam['exam_id']}-{drive['drive_id']}",
                        "conflict_category": "Placement and Examination Conflict",
                        "severity": "Critical",
                        "root_cause": (
                            f"Mandatory exam {exam['exam_id']} ({exam['department']} Sem-{exam['semester']}) "
                            f"overlaps with {drive['company_name']} placement drive ({drive['drive_id']}) on {exam['day_of_week']}."
                        ),
                        "affected_resource_ids": [exam["exam_id"], drive["drive_id"], exam["hall_id"], drive["venue_id"]],
                        "affected_student_ids": sorted(set(affected_stu)),
                        "detection_timestamp": now,
                        "operational_impact": f"{len(affected_stu)} eligible/registered Sem-{exam['semester']} students face an impossible mandatory exam vs placement schedule.",
                        "suggested_resolution": "Reschedule placement interview batch to afternoon slot (14:00-17:00); preserve mandatory exam slot as hard constraint.",
                        "resolution_status": "Open",
                    }
                )

    # 3. Event & Examination Venue/Building Overlap
    hall_map = {h["hall_id"]: h for h in snapshot.get("exam_halls", [])}
    venue_map = {v["venue_id"]: v for v in snapshot.get("event_venues", [])}
    for exam in snapshot.get("examinations", []):
        ehall = hall_map.get(exam["hall_id"], {})
        for evt in snapshot.get("events", []):
            evenue = venue_map.get(evt["venue_id"], {})
            if (
                ehall.get("building_id")
                and ehall.get("building_id") == evenue.get("building_id")
                and exam["day_of_week"] == evt["day_of_week"]
                and exam["time_slot"] == evt["time_slot"]
            ):
                affected_stu = [
                    s["student_id"]
                    for s in students
                    if s["department"] == exam["department"] and s["semester"] == exam["semester"]
                ]
                conflicts.append(
                    {
                        "conflict_id": f"CONF-EVT-EXM-{exam['exam_id']}-{evt['event_id']}",
                        "conflict_category": "Event Venue Conflict",
                        "severity": "High",
                        "root_cause": (
                            f"High-attendance event '{evt['event_name']}' ({evt['expected_participants']} participants) "
                            f"in {evenue.get('building_id')} overlaps with mandatory exam {exam['exam_id']} on {exam['day_of_week']} ({exam['time_slot']})."
                        ),
                        "affected_resource_ids": [exam["hall_id"], evt["venue_id"], exam["exam_id"], evt["event_id"]],
                        "affected_student_ids": sorted(set(affected_stu)),
                        "detection_timestamp": now,
                        "operational_impact": "Acoustic/crowd disruption and shared corridor congestion during mandatory written examination.",
                        "suggested_resolution": f"Move {evt['event_id']} to afternoon slot or relocate {exam['exam_id']} to HALL-EXAM-2.",
                        "resolution_status": "Open",
                    }
                )

    # 4. Capacity Checks (Classrooms, Buses, Hostel Rooms)
    classroom_map = {c["classroom_id"]: c for c in snapshot.get("classrooms", [])}
    stu_per_room = defaultdict(list)
    for s in students:
        stu_per_room[s["classroom_id"]].append(s["student_id"])
    for cid, sids in stu_per_room.items():
        cap = classroom_map.get(cid, {}).get("capacity", 0)
        if cap and len(sids) > cap:
            conflicts.append(
                {
                    "conflict_id": f"CONF-CAP-{cid}",
                    "conflict_category": "Classroom Capacity Violation",
                    "severity": "Medium",
                    "root_cause": f"Classroom {cid} has {len(sids)} assigned students exceeding capacity {cap}.",
                    "affected_resource_ids": [cid],
                    "affected_student_ids": sorted(sids),
                    "detection_timestamp": now,
                    "operational_impact": f"Overcrowding by {len(sids) - cap} seats.",
                    "suggested_resolution": "Reallocate section to larger classroom or split practical batches.",
                    "resolution_status": "Open",
                }
            )

    for bus in snapshot.get("buses", []):
        rid = bus["route_id"]
        riders = students_by_bus.get(rid, [])
        if len(riders) > bus["capacity"]:
            conflicts.append(
                {
                    "conflict_id": f"CONF-BUS-CAP-{rid}",
                    "conflict_category": "Transportation Capacity Violation",
                    "severity": "High",
                    "root_cause": f"Route {rid} has {len(riders)} assigned students exceeding bus {bus['bus_id']} capacity ({bus['capacity']}).",
                    "affected_resource_ids": [rid, bus["bus_id"]],
                    "affected_student_ids": sorted(riders),
                    "detection_timestamp": now,
                    "operational_impact": f"{len(riders) - bus['capacity']} students lack guaranteed seating.",
                    "suggested_resolution": "Deploy standby shuttle BKP-BUS-SPARE on corridor.",
                    "resolution_status": "Open",
                }
            )

    for room in snapshot.get("hostel_rooms", []):
        occ = len(students_by_hostel_room.get(room["room_id"], []))
        if occ > room["capacity"]:
            conflicts.append(
                {
                    "conflict_id": f"CONF-HOSTEL-CAP-{room['room_id']}",
                    "conflict_category": "Hostel Capacity Violation",
                    "severity": "Medium",
                    "root_cause": f"Hostel room {room['room_id']} occupancy ({occ}) exceeds capacity ({room['capacity']}).",
                    "affected_resource_ids": [room["room_id"]],
                    "affected_student_ids": sorted(students_by_hostel_room[room["room_id"]]),
                    "detection_timestamp": now,
                    "operational_impact": "Hostel overcrowding risk.",
                    "suggested_resolution": "Reassign excess resident to vacant room in same block.",
                    "resolution_status": "Open",
                }
            )

    # 5. Infrastructure Single-Point-of-Failure & Unavailability Risks
    for inf in snapshot.get("infrastructure", []):
        if inf["operational_status"] != "Operational" or (
            inf["redundancy_level"] in ("Single Point of Failure", "No Automated Backup")
            and inf["criticality_score"] >= 88
        ):
            is_down = inf["operational_status"] != "Operational"
            conflicts.append(
                {
                    "conflict_id": f"CONF-INFRA-{inf['infra_id']}",
                    "conflict_category": "Infrastructure Dependency Failure",
                    "severity": "Critical" if is_down else "Medium",
                    "root_cause": (
                        f"{inf['infra_name']} is currently {inf['operational_status']}."
                        if is_down
                        else f"{inf['infra_name']} operates as a {inf['redundancy_level']} (criticality {inf['criticality_score']}/100)."
                    ),
                    "affected_resource_ids": [inf["infra_id"]],
                    "affected_student_ids": [],
                    "detection_timestamp": now,
                    "operational_impact": "Downstream online exams, placement portals, or hostel utilities face unbuffered failure exposure.",
                    "suggested_resolution": f"Provision redundant failover or pre-stage backup resource for {inf['infra_id']}.",
                    "resolution_status": "Open",
                }
            )

    return conflicts
