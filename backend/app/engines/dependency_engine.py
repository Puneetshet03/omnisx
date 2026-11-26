"""OMNIS-X NetworkX Institutional Dependency Graph Engine.

Models infrastructure, facilities, academic schedules, examinations, hostels,
transportation, placements, and events as a directed dependency graph.
Clearly distinguishes mandatory operational dependencies from informational
associations (e.g., faculty mentor relationships are NOT mandatory teaching edges).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import networkx as nx


def build_dependency_graph(snapshot: Dict[str, Any]) -> nx.DiGraph:
    """Construct the complete directed institutional dependency graph."""
    g = nx.DiGraph()

    # 1. Infrastructure nodes
    for inf in snapshot.get("infrastructure", []):
        g.add_node(
            inf["infra_id"],
            node_id=inf["infra_id"],
            resource_id=inf["infra_id"],
            resource_type=inf["infra_type"],
            resource_name=inf["infra_name"],
            department="INFRA",
            building_id=inf["building_id"],
            operational_status=inf["operational_status"],
            availability=inf["operational_status"] == "Operational",
            capacity=inf["capacity"],
            criticality=inf["criticality_score"],
            backup_resource=inf.get("backup_resource_id"),
            recovery_priority=1,
        )

    # Power -> Network & Water dependencies
    for net in snapshot.get("network_resources", []):
        if net.get("power_dependency_id"):
            g.add_edge(
                net["power_dependency_id"],
                net["network_id"],
                dependency_type="PowerFeed",
                is_mandatory=True,
                dependency_strength=0.95,
                propagation_delay_minutes=2,
                impact_weight=0.95,
                alternative_dependency=net.get("backup_link_id"),
            )

    for wtr in snapshot.get("water_supply", []):
        if wtr.get("power_dependency_id"):
            g.add_edge(
                wtr["power_dependency_id"],
                wtr["water_id"],
                dependency_type="PumpPower",
                is_mandatory=True,
                dependency_strength=0.90,
                propagation_delay_minutes=15,
                impact_weight=0.85,
                alternative_dependency="BKP-WATER-TANKER",
            )

    # 2. Classrooms
    for rm in snapshot.get("classrooms", []):
        rid = rm["classroom_id"]
        g.add_node(
            rid,
            node_id=rid,
            resource_id=rid,
            resource_type="Classroom",
            resource_name=rm["classroom_name"],
            department=rm["department"],
            building_id=rm["building_id"],
            operational_status=rm["operational_status"],
            availability=rm["operational_status"] == "Operational",
            capacity=rm["capacity"],
            criticality=65,
            backup_resource="HALL-SEMINAR",
            recovery_priority=3,
        )
        if rm.get("power_dependency_id"):
            g.add_edge(
                rm["power_dependency_id"],
                rid,
                dependency_type="ClassroomPower",
                is_mandatory=False,  # Lectures can continue on daylight/emergency backup if minor
                dependency_strength=0.55,
                propagation_delay_minutes=10,
                impact_weight=0.50,
                alternative_dependency="GEN-01",
            )
        if rm.get("network_dependency_id"):
            g.add_edge(
                rm["network_dependency_id"],
                rid,
                dependency_type="SmartBoardNetwork",
                is_mandatory=False,
                dependency_strength=0.35,
                propagation_delay_minutes=5,
                impact_weight=0.30,
                alternative_dependency=None,
            )

    # 3. Laboratories (mandatory power & network dependencies)
    for lab in snapshot.get("laboratories", []):
        lid = lab["lab_id"]
        g.add_node(
            lid,
            node_id=lid,
            resource_id=lid,
            resource_type="Laboratory",
            resource_name=lab["lab_name"],
            department=lab["department"],
            building_id=lab["building_id"],
            operational_status=lab["operational_status"],
            availability=lab["operational_status"] == "Operational",
            capacity=lab["capacity"],
            criticality=86,
            backup_resource=None,
            recovery_priority=2,
        )
        if lab.get("power_dependency_id"):
            g.add_edge(
                lab["power_dependency_id"],
                lid,
                dependency_type="LabPower",
                is_mandatory=True,
                dependency_strength=0.98,
                propagation_delay_minutes=1,
                impact_weight=0.95,
                alternative_dependency="GEN-01" if lab["power_dependency_id"] == "PWR-ACAD-A" else "GEN-02",
            )
        if lab.get("network_dependency_id"):
            g.add_edge(
                lab["network_dependency_id"],
                lid,
                dependency_type="LabNetwork",
                is_mandatory=True,
                dependency_strength=0.85,
                propagation_delay_minutes=3,
                impact_weight=0.80,
                alternative_dependency="BKP-NET-4G",
            )

    # 4. Faculty
    for fac in snapshot.get("faculty", []):
        fid = fac["faculty_id"]
        g.add_node(
            fid,
            node_id=fid,
            resource_id=fid,
            resource_type="Faculty",
            resource_name=fac["faculty_name"],
            department=fac["department"],
            building_id=f"BLDG-{fac['department']}",
            operational_status=fac["operational_status"],
            availability=fac["availability_status"] == "Available",
            capacity=fac["max_weekly_hours"],
            criticality=72,
            backup_resource=None,
            recovery_priority=2,
        )

    # 5. Academic Groups & Timetable Sessions
    for grp in snapshot.get("academic_groups", []):
        gid = grp["group_id"]
        g.add_node(
            gid,
            node_id=gid,
            resource_id=gid,
            resource_type="AcademicGroup",
            resource_name=f"{grp['department']} Sem-{grp['semester']} Sec-{grp['section']}",
            department=grp["department"],
            building_id=f"BLDG-{grp['department']}",
            operational_status="Operational",
            availability=True,
            capacity=grp["student_count"],
            criticality=75,
            backup_resource=None,
            recovery_priority=2,
        )

    for sess in snapshot.get("timetable", []):
        sid = sess["session_id"]
        dept = sess["academic_group_id"].split("-")[1]
        g.add_node(
            sid,
            node_id=sid,
            resource_id=sid,
            resource_type="AcademicSession",
            resource_name=f"{sess['subject_code']} ({sess['session_type']})",
            department=dept,
            building_id=f"BLDG-{dept}",
            operational_status=sess["operational_status"],
            availability=True,
            capacity=35,
            criticality=78 if sess["session_type"] == "Practical" else 70,
            backup_resource=None,
            recovery_priority=2,
        )
        g.add_edge(
            sess["room_id"],
            sid,
            dependency_type="RoomHosting",
            is_mandatory=True,
            dependency_strength=0.95,
            propagation_delay_minutes=0,
            impact_weight=0.90,
            alternative_dependency=None,
        )
        g.add_edge(
            sess["faculty_id"],
            sid,
            dependency_type="FacultyInstruction",
            is_mandatory=True,
            dependency_strength=0.90,
            propagation_delay_minutes=0,
            impact_weight=0.85,
            alternative_dependency=None,
        )
        g.add_edge(
            sid,
            sess["academic_group_id"],
            dependency_type="GroupCurriculum",
            is_mandatory=True,
            dependency_strength=0.85,
            propagation_delay_minutes=5,
            impact_weight=0.80,
            alternative_dependency=None,
        )

    # 6. Examination Halls & Examinations
    for hall in snapshot.get("exam_halls", []):
        hid = hall["hall_id"]
        g.add_node(
            hid,
            node_id=hid,
            resource_id=hid,
            resource_type="ExamHall",
            resource_name=hall["hall_name"],
            department="EXAM",
            building_id=hall["building_id"],
            operational_status=hall["operational_status"],
            availability=True,
            capacity=hall["capacity"],
            criticality=92,
            backup_resource="HALL-SEMINAR" if hid != "HALL-SEMINAR" else None,
            recovery_priority=1,
        )
        if hall.get("power_dependency_id"):
            g.add_edge(
                hall["power_dependency_id"],
                hid,
                dependency_type="ExamPower",
                is_mandatory=True,
                dependency_strength=0.95,
                propagation_delay_minutes=2,
                impact_weight=0.95,
                alternative_dependency="GEN-01",
            )
        if hall.get("network_dependency_id") and hall.get("supports_online_exam"):
            g.add_edge(
                hall["network_dependency_id"],
                hid,
                dependency_type="ExamNetwork",
                is_mandatory=True,
                dependency_strength=0.95,
                propagation_delay_minutes=1,
                impact_weight=0.95,
                alternative_dependency=None,
            )

    for exam in snapshot.get("examinations", []):
        eid = exam["exam_id"]
        g.add_node(
            eid,
            node_id=eid,
            resource_id=eid,
            resource_type="Examination",
            resource_name=exam["exam_name"],
            department=exam["department"],
            building_id="BLDG-EXAM",
            operational_status=exam["operational_status"],
            availability=True,
            capacity=50,
            criticality=96,
            backup_resource=None,
            recovery_priority=1,
        )
        g.add_edge(
            exam["hall_id"],
            eid,
            dependency_type="ExamVenue",
            is_mandatory=True,
            dependency_strength=0.98,
            propagation_delay_minutes=0,
            impact_weight=0.98,
            alternative_dependency="HALL-SEMINAR",
        )
        g.add_edge(
            exam["invigilator_id"],
            eid,
            dependency_type="ExamInvigilation",
            is_mandatory=True,
            dependency_strength=0.85,
            propagation_delay_minutes=0,
            impact_weight=0.85,
            alternative_dependency=None,
        )

    # 7. Hostels & Water/Power
    for blk in snapshot.get("hostel_blocks", []):
        bid = blk["block_id"]
        g.add_node(
            bid,
            node_id=bid,
            resource_id=bid,
            resource_type="HostelBlock",
            resource_name=blk["block_name"],
            department="HOSTEL",
            building_id=blk["building_id"],
            operational_status=blk["operational_status"],
            availability=True,
            capacity=blk["total_rooms"] * 2,
            criticality=84,
            backup_resource=None,
            recovery_priority=2,
        )
        g.add_edge(
            blk["power_dependency_id"],
            bid,
            dependency_type="HostelPower",
            is_mandatory=True,
            dependency_strength=0.85,
            propagation_delay_minutes=10,
            impact_weight=0.80,
            alternative_dependency="GEN-02",
        )
        g.add_edge(
            blk["water_dependency_id"],
            bid,
            dependency_type="HostelWater",
            is_mandatory=True,
            dependency_strength=0.95,
            propagation_delay_minutes=20,
            impact_weight=0.90,
            alternative_dependency="BKP-WATER-TANKER",
        )

    # 8. Transportation Routes & Buses
    for rt in snapshot.get("bus_routes", []):
        if not rt.get("is_college_bus"):
            continue
        rid = rt["route_id"]
        g.add_node(
            rid,
            node_id=rid,
            resource_id=rid,
            resource_type="BusRoute",
            resource_name=f"{rid} ({rt['route_name']})",
            department="TRANSPORT",
            building_id="BLDG-TRANS",
            operational_status=rt["operational_status"],
            availability=True,
            capacity=45,
            criticality=78,
            backup_resource="BKP-BUS-SPARE",
            recovery_priority=2,
        )

    for bus in snapshot.get("buses", []):
        if bus.get("driver_id"):
            drv_id = bus["driver_id"]
            g.add_node(
                drv_id,
                node_id=drv_id,
                resource_id=drv_id,
                resource_type="Driver",
                resource_name=f"Driver {drv_id}",
                department="TRANSPORT",
                building_id="BLDG-TRANS",
                operational_status="Operational",
                availability=True,
                capacity=1,
                criticality=70,
                backup_resource="DRV-05",
                recovery_priority=2,
            )
            g.add_edge(
                drv_id,
                bus["route_id"],
                dependency_type="DriverOperation",
                is_mandatory=True,
                dependency_strength=0.92,
                propagation_delay_minutes=5,
                impact_weight=0.90,
                alternative_dependency="DRV-05",
            )

    for drv in snapshot.get("drivers", []):
        drv_id = drv["driver_id"]
        if drv_id not in g:
            g.add_node(
                drv_id,
                node_id=drv_id,
                resource_id=drv_id,
                resource_type="Driver",
                resource_name=f"{drv.get('driver_name', drv_id)} ({drv_id})",
                department="TRANSPORT",
                building_id="BLDG-TRANS",
                operational_status=drv.get("availability_status", "Standby"),
                availability=drv.get("availability_status") == "Available",
                capacity=1,
                criticality=55,
                backup_resource=None,
                recovery_priority=3,
            )

    # 9. Placement & Events Venues
    for pv in snapshot.get("event_venues", []):
        vid = pv["venue_id"]
        g.add_node(
            vid,
            node_id=vid,
            resource_id=vid,
            resource_type="Venue",
            resource_name=pv["venue_name"],
            department="ADMIN",
            building_id=pv["building_id"],
            operational_status=pv["operational_status"],
            availability=True,
            capacity=pv["capacity"],
            criticality=76,
            backup_resource=None,
            recovery_priority=3,
        )
        if pv.get("power_dependency_id"):
            g.add_edge(
                pv["power_dependency_id"],
                vid,
                dependency_type="VenuePower",
                is_mandatory=True,
                dependency_strength=0.85,
                propagation_delay_minutes=5,
                impact_weight=0.80,
                alternative_dependency="GEN-02",
            )
        if pv.get("network_dependency_id"):
            g.add_edge(
                pv["network_dependency_id"],
                vid,
                dependency_type="VenueNetwork",
                is_mandatory=True,
                dependency_strength=0.88,
                propagation_delay_minutes=2,
                impact_weight=0.85,
                alternative_dependency=None,
            )

    for plc in snapshot.get("placement_drives", []):
        pid = plc["drive_id"]
        g.add_node(
            pid,
            node_id=pid,
            resource_id=pid,
            resource_type="PlacementDrive",
            resource_name=f"{plc['company_name']} Drive",
            department="PLACEMENT",
            building_id="BLDG-PLACE",
            operational_status=plc["operational_status"],
            availability=True,
            capacity=100,
            criticality=82,
            backup_resource=None,
            recovery_priority=2,
        )
        g.add_edge(
            plc["venue_id"],
            pid,
            dependency_type="PlacementVenue",
            is_mandatory=True,
            dependency_strength=0.92,
            propagation_delay_minutes=0,
            impact_weight=0.90,
            alternative_dependency="VENUE-SEMINAR-1",
        )

    for evt in snapshot.get("events", []):
        evid = evt["event_id"]
        g.add_node(
            evid,
            node_id=evid,
            resource_id=evid,
            resource_type="Event",
            resource_name=evt["event_name"],
            department=evt.get("target_department") or "ADMIN",
            building_id="BLDG-SEMINAR",
            operational_status=evt["operational_status"],
            availability=True,
            capacity=evt["expected_participants"],
            criticality=55,
            backup_resource=None,
            recovery_priority=4,
        )
        g.add_edge(
            evt["venue_id"],
            evid,
            dependency_type="EventVenue",
            is_mandatory=True,
            dependency_strength=0.85,
            propagation_delay_minutes=0,
            impact_weight=0.75,
            alternative_dependency=None,
        )

    return g


def export_graph_payload(g: nx.DiGraph, department: Optional[str] = None, resource_type: Optional[str] = None) -> Dict[str, Any]:
    """Serialize NetworkX graph for React Flow & API consumers."""
    nodes = []
    allowed_ids = set()
    for nid, data in g.nodes(data=True):
        if department and data.get("department") not in (department, "INFRA", "EXAM"):
            continue
        if resource_type and data.get("resource_type") != resource_type:
            continue
        allowed_ids.add(nid)
        nodes.append({"id": nid, **data})

    edges = []
    for src, dst, edata in g.edges(data=True):
        if src in allowed_ids and dst in allowed_ids:
            edges.append({"id": f"{src}->{dst}", "source": src, "target": dst, **edata})

    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
    }


def get_student_dependency_network(student: Dict[str, Any], snapshot: Dict[str, Any], g: nx.DiGraph) -> Dict[str, Any]:
    """Build an explainable dependency tree for a single student without treating mentor as teaching dependency."""
    group_id = f"GRP-{student['department']}-{student['semester']}-{student['section']}"
    direct_nodes = [
        {"id": student["student_id"], "label": student["student_name"], "type": "Student", "mandatory": True},
        {"id": group_id, "label": f"Group {group_id}", "type": "AcademicGroup", "mandatory": True},
        {"id": student["classroom_id"], "label": student["classroom_id"], "type": "Classroom", "mandatory": True},
        {"id": student["lab_id"], "label": student["lab_id"], "type": "Laboratory", "mandatory": True},
        {"id": student["mentor_id"], "label": f"Mentor {student['mentor_id']} (Advisory)", "type": "Mentor", "mandatory": False},
    ]
    links = [
        {"source": group_id, "target": student["student_id"], "relation": "Enrolled Group", "is_mandatory": True},
        {"source": student["classroom_id"], "target": student["student_id"], "relation": "Primary Classroom", "is_mandatory": True},
        {"source": student["lab_id"], "target": student["student_id"], "relation": "Assigned Lab", "is_mandatory": True},
        {"source": student["mentor_id"], "target": student["student_id"], "relation": "Advisory Mentor (Non-Teaching)", "is_mandatory": False},
    ]

    if student.get("hostel_room"):
        room = next((r for r in snapshot["hostel_rooms"] if r["room_id"] == student["hostel_room"]), None)
        block_id = room["block_id"] if room else "HB-NORTH"
        direct_nodes.append({"id": student["hostel_room"], "label": f"Hostel {student['hostel_room']}", "type": "HostelRoom", "mandatory": True})
        direct_nodes.append({"id": block_id, "label": block_id, "type": "HostelBlock", "mandatory": True})
        links.append({"source": block_id, "target": student["hostel_room"], "relation": "Hostel Services", "is_mandatory": True})
        links.append({"source": student["hostel_room"], "target": student["student_id"], "relation": "Residence", "is_mandatory": True})

    if student.get("bus_route") and student["bus_route"] != "Self":
        direct_nodes.append({"id": student["bus_route"], "label": student["bus_route"], "type": "BusRoute", "mandatory": True})
        links.append({"source": student["bus_route"], "target": student["student_id"], "relation": "Daily Commute", "is_mandatory": True})

    # Add upstream infrastructure ancestors of classroom & lab
    ancestors = set()
    for target in (student["classroom_id"], student["lab_id"]):
        if target in g:
            for anc in nx.ancestors(g, target):
                if g.nodes[anc].get("resource_type") in ("Power", "Network", "Water"):
                    ancestors.add(anc)
    for anc in sorted(ancestors):
        ndata = g.nodes[anc]
        direct_nodes.append({"id": anc, "label": ndata["resource_name"], "type": ndata["resource_type"], "mandatory": True})
        if student["lab_id"] in g and g.has_edge(anc, student["lab_id"]):
            links.append({"source": anc, "target": student["lab_id"], "relation": "Infrastructure Feed", "is_mandatory": True})
        if student["classroom_id"] in g and g.has_edge(anc, student["classroom_id"]):
            links.append({"source": anc, "target": student["classroom_id"], "relation": "Infrastructure Feed", "is_mandatory": False})

    return {"student_id": student["student_id"], "nodes": direct_nodes, "links": links}
