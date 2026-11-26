"""OMNIS-X Supporting Institutional Resource Builder.

Derives resource identifiers directly from the authoritative 200-student CSV
(departments, academic groups, classrooms, labs, mentors, hostel rooms, bus routes)
and generates clearly labeled `synthetic_supporting` demonstration records for
schedules, capacities, infrastructure, equipment, exams, placements, and events.
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import CSV_PATH
from import_students import validate_and_prepare_students

DEPT_META: Dict[str, Dict[str, str]] = {
    "CSE": {"name": "Computer Science & Engineering", "building": "BLDG-CSE"},
    "ISE": {"name": "Information Science & Engineering", "building": "BLDG-ISE"},
    "ECE": {"name": "Electronics & Communication Engineering", "building": "BLDG-ECE"},
    "ME": {"name": "Mechanical Engineering", "building": "BLDG-ME"},
    "CV": {"name": "Civil Engineering", "building": "BLDG-CV"},
}

FACULTY_NAMES: Dict[str, tuple] = {
    "FAC-CSE-1": ("Dr. Ananya Sharma", "Professor", ["Ph.D. AI & Systems", "Distributed Computing"]),
    "FAC-CSE-2": ("Prof. Vikram Deshmukh", "Associate Professor", ["M.Tech CS", "Operating Systems"]),
    "FAC-CSE-3": ("Dr. Meera Krishnan", "Professor", ["Ph.D. Algorithms", "Database Engineering"]),
    "FAC-CSE-4": ("Prof. Rohan Kulkarni", "Assistant Professor", ["M.Tech Networks", "Cybersecurity"]),
    "FAC-ISE-1": ("Dr. Kavita Nair", "Professor", ["Ph.D. Data Science", "Cloud Architecture"]),
    "FAC-ISE-2": ("Prof. Siddharth Rao", "Associate Professor", ["M.Tech Software Eng", "DevOps"]),
    "FAC-ISE-3": ("Dr. Priya Menon", "Associate Professor", ["Ph.D. ML", "Information Security"]),
    "FAC-ISE-4": ("Prof. Arjun Hegde", "Assistant Professor", ["M.Tech Web Tech", "Full-Stack Systems"]),
    "FAC-ECE-1": ("Dr. Rajesh Iyer", "Professor", ["Ph.D. VLSI", "Embedded Systems"]),
    "FAC-ECE-2": ("Prof. Sneha Patil", "Associate Professor", ["M.Tech Signal Processing", "DSP"]),
    "FAC-ECE-3": ("Dr. Karthik Verma", "Associate Professor", ["Ph.D. RF & IoT", "Communication Systems"]),
    "FAC-ECE-4": ("Prof. Divya Joshi", "Assistant Professor", ["M.Tech Microelectronics", "Control Systems"]),
    "FAC-ME-1": ("Dr. Suresh Babu", "Professor", ["Ph.D. Thermal Eng", "CAD/CAM"]),
    "FAC-ME-2": ("Prof. Manoj Gowda", "Associate Professor", ["M.Tech Robotics", "Mechatronics"]),
    "FAC-ME-3": ("Dr. Lakshmi Narayan", "Associate Professor", ["Ph.D. Manufacturing", "Fluid Mechanics"]),
    "FAC-ME-4": ("Prof. Nikhil Shetty", "Assistant Professor", ["M.Tech Machine Design", "Dynamics"]),
    "FAC-CV-1": ("Dr. Prakash Rao", "Professor", ["Ph.D. Structural Eng", "Geotechnical"]),
    "FAC-CV-2": ("Prof. Nandini Murthy", "Associate Professor", ["M.Tech Transportation", "Surveying"]),
    "FAC-CV-3": ("Dr. Harish Kumar", "Associate Professor", ["Ph.D. Environmental", "Hydraulics"]),
    "FAC-CV-4": ("Prof. Pooja Bhat", "Assistant Professor", ["M.Tech Construction", "GIS & CAD"]),
}

LAB_SPECS: Dict[str, Dict[str, Any]] = {
    "LAB-CSE-1": {"name": "CSE Systems & Cloud Lab", "power": "PWR-ACAD-A", "net": "NET-CORE", "equip": ["High-Perf Workstations", "GPU Compute Rack", "Managed L3 Switch"]},
    "LAB-CSE-2": {"name": "CSE AI & Cybersecurity Lab", "power": "PWR-ACAD-A", "net": "NET-CORE", "equip": ["AI Inference Nodes", "Cyber Range Cluster", "Smart UPS"]},
    "LAB-ISE-1": {"name": "ISE Software Engineering Lab", "power": "PWR-ACAD-A", "net": "NET-CORE", "equip": ["Dual-Boot Workstations", "CI/CD Runner Rack", "Projector Array"]},
    "LAB-ISE-2": {"name": "ISE Data Analytics Lab", "power": "PWR-ACAD-A", "net": "NET-CORE", "equip": ["Analytics Terminals", "Cluster Storage", "Gigabit Switch"]},
    "LAB-ECE-1": {"name": "ECE VLSI & Embedded Lab", "power": "PWR-ACAD-B", "net": "NET-CORE", "equip": ["FPGA Dev Boards", "Digital Oscilloscopes", "Logic Analyzers"]},
    "LAB-ECE-2": {"name": "ECE IoT & Signal Processing Lab", "power": "PWR-ACAD-B", "net": "NET-CORE", "equip": ["DSP Kits", "RF Spectrum Analyzer", "IoT Gateway Bench"]},
    "LAB-ME-1": {"name": "ME CAD/CAM & Robotics Lab", "power": "PWR-ACAD-B", "net": "NET-CORE", "equip": ["CNC Trainer", "6-Axis Robot Arm", "CAD Workstations"]},
    "LAB-ME-2": {"name": "ME Thermal & Fluid Dynamics Lab", "power": "PWR-ACAD-B", "net": "NET-CORE", "equip": ["Wind Tunnel Unit", "Heat Exchanger Rig", "DAQ Sensors"]},
    "LAB-CV-1": {"name": "CV Structural & Material Testing Lab", "power": "PWR-ACAD-B", "net": "NET-CORE", "equip": ["Universal Testing Machine", "Concrete Compression Rig", "Strain Gauges"]},
    "LAB-CV-2": {"name": "CV Geomatics & GIS Lab", "power": "PWR-ACAD-B", "net": "NET-CORE", "equip": ["Total Station Kits", "GIS Workstations", "Plotter Unit"]},
}


def build_institutional_dataset(csv_path: Path = CSV_PATH) -> Dict[str, Any]:
    """Construct complete institutional baseline state from CSV + labeled synthetic supporting records."""
    students, csv_report = validate_and_prepare_students(csv_path)

    # 1. Departments (derived from CSV)
    departments = [
        {
            "department_code": code,
            "department_name": meta["name"],
            "building_id": meta["building"],
            "head_faculty_id": f"FAC-{code}-1",
            "operational_status": "Operational",
            "source_type": "derived_from_csv",
        }
        for code, meta in DEPT_META.items()
    ]

    # 2. Infrastructure (synthetic_supporting)
    infrastructure = [
        {
            "infra_id": "PWR-ACAD-A",
            "infra_name": "Main Academic Substation A (CSE/ISE)",
            "infra_type": "Power",
            "building_id": "BLDG-POWER",
            "capacity": 500.0,
            "current_load": 335.0,
            "redundancy_level": "N+1 Generator",
            "backup_resource_id": "GEN-01",
            "operational_status": "Operational",
            "criticality_score": 98,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "PWR-ACAD-B",
            "infra_name": "Engineering Block Substation B (ECE/ME/CV)",
            "infra_type": "Power",
            "building_id": "BLDG-POWER",
            "capacity": 450.0,
            "current_load": 290.0,
            "redundancy_level": "Partial Backup",
            "backup_resource_id": "GEN-02",
            "operational_status": "Operational",
            "criticality_score": 94,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "PWR-HOSTEL",
            "infra_name": "Hostel & Campus Utility Feeder",
            "infra_type": "Power",
            "building_id": "BLDG-POWER",
            "capacity": 300.0,
            "current_load": 195.0,
            "redundancy_level": "Partial Backup",
            "backup_resource_id": "GEN-02",
            "operational_status": "Operational",
            "criticality_score": 88,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "GEN-01",
            "infra_name": "Primary Diesel Backup Generator 350kVA",
            "infra_type": "BackupGenerator",
            "building_id": "BLDG-GEN",
            "capacity": 350.0,
            "current_load": 0.0,
            "redundancy_level": "Standby Ready",
            "backup_resource_id": None,
            "operational_status": "Operational",
            "criticality_score": 92,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "GEN-02",
            "infra_name": "Secondary Backup Generator 250kVA",
            "infra_type": "BackupGenerator",
            "building_id": "BLDG-GEN",
            "capacity": 250.0,
            "current_load": 0.0,
            "redundancy_level": "Standby Ready",
            "backup_resource_id": None,
            "operational_status": "Operational",
            "criticality_score": 85,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "NET-CORE",
            "infra_name": "Campus Fiber Core & Wi-Fi NOC",
            "infra_type": "Network",
            "building_id": "BLDG-NET",
            "capacity": 20.0,
            "current_load": 11.4,
            "redundancy_level": "Dual ISP (Failover)",
            "backup_resource_id": "NET-BACKUP",
            "operational_status": "Operational",
            "criticality_score": 96,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "NET-EXAM",
            "infra_name": "Dedicated Exam & Placement VLAN",
            "infra_type": "Network",
            "building_id": "BLDG-NET",
            "capacity": 10.0,
            "current_load": 4.2,
            "redundancy_level": "Single Point of Failure",
            "backup_resource_id": None,
            "operational_status": "Operational",
            "criticality_score": 95,
            "source_type": "synthetic_supporting",
        },
        {
            "infra_id": "WTR-HOSTEL",
            "infra_name": "Hostel Overhead & Sump Water Pump",
            "infra_type": "Water",
            "building_id": "BLDG-WATER",
            "capacity": 120000.0,
            "current_load": 78000.0,
            "redundancy_level": "No Automated Backup",
            "backup_resource_id": None,
            "operational_status": "Operational",
            "criticality_score": 89,
            "source_type": "synthetic_supporting",
        },
    ]

    power_supply = [
        {"power_id": "PWR-ACAD-A", "zone_name": "North Academic Zone (CSE/ISE/Exam)", "voltage_kv": 11.0, "capacity_kva": 500.0, "load_kva": 335.0, "feeds_buildings": ["BLDG-CSE", "BLDG-ISE", "BLDG-NET", "BLDG-EXAM"], "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"power_id": "PWR-ACAD-B", "zone_name": "South Engineering Zone (ECE/ME/CV)", "voltage_kv": 11.0, "capacity_kva": 450.0, "load_kva": 290.0, "feeds_buildings": ["BLDG-ECE", "BLDG-ME", "BLDG-CV", "BLDG-PLACE"], "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"power_id": "PWR-HOSTEL", "zone_name": "Residential & Water Utility Zone", "voltage_kv": 11.0, "capacity_kva": 300.0, "load_kva": 195.0, "feeds_buildings": ["BLDG-HOSTEL-N", "BLDG-HOSTEL-S", "BLDG-WATER"], "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]

    backup_generators = [
        {"generator_id": "GEN-01", "generator_name": "Primary 350kVA Diesel Generator", "capacity_kva": 350.0, "fuel_percent": 94.0, "auto_transfer_seconds": 15, "covers_buildings": ["BLDG-CSE", "BLDG-ISE", "BLDG-NET", "BLDG-EXAM"], "operational_status": "Standby", "source_type": "synthetic_supporting"},
        {"generator_id": "GEN-02", "generator_name": "Secondary 250kVA Diesel Generator", "capacity_kva": 250.0, "fuel_percent": 88.0, "auto_transfer_seconds": 25, "covers_buildings": ["BLDG-ECE", "BLDG-ME", "BLDG-CV", "BLDG-HOSTEL-N"], "operational_status": "Standby", "source_type": "synthetic_supporting"},
    ]

    network_resources = [
        {"network_id": "NET-CORE", "node_name": "Campus Fiber Core NOC", "bandwidth_gbps": 20.0, "power_dependency_id": "PWR-ACAD-A", "backup_link_id": "BKP-NET-4G", "covers_buildings": ["BLDG-CSE", "BLDG-ISE", "BLDG-ECE", "BLDG-ME", "BLDG-CV", "BLDG-ADMIN"], "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"network_id": "NET-EXAM", "node_name": "Examination & Placement Secure Segment", "bandwidth_gbps": 10.0, "power_dependency_id": "PWR-ACAD-A", "backup_link_id": None, "covers_buildings": ["BLDG-EXAM", "BLDG-PLACE"], "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]

    water_supply = [
        {"water_id": "WTR-HOSTEL", "tank_name": "Hostel & Campus Water Distribution", "capacity_liters": 120000, "current_level_percent": 86.0, "power_dependency_id": "PWR-HOSTEL", "serves_buildings": ["BLDG-HOSTEL-N", "BLDG-HOSTEL-S"], "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]

    # 3. Faculty (20 mentors derived from CSV + synthetic teaching profiles)
    mentor_ids = sorted({s["mentor_id"] for s in students})
    faculty = []
    for fid in mentor_ids:
        dept = fid.split("-")[1]
        name, desig, quals = FACULTY_NAMES.get(fid, (f"Prof. {fid}", "Assistant Professor", ["M.Tech"]))
        faculty.append(
            {
                "faculty_id": fid,
                "faculty_name": name,
                "department": dept,
                "designation": desig,
                "qualifications": quals,
                "subjects_qualified": [f"{dept}101", f"{dept}301", f"{dept}501", f"{dept}701"],
                "max_weekly_hours": 18,
                "current_weekly_hours": 12,
                "availability_status": "Available",
                "is_mentor": True,
                "operational_status": "Operational",
                "source_type": "synthetic_supporting",
            }
        )

    # 4. Classrooms (40 derived from CSV)
    classroom_ids = sorted({s["classroom_id"] for s in students})
    classrooms = []
    for cid in classroom_ids:
        parts = cid.split("-")
        dept = parts[1]
        sem = int(parts[2])
        sec = parts[3]
        power_dep = "PWR-ACAD-A" if dept in ("CSE", "ISE") else "PWR-ACAD-B"
        classrooms.append(
            {
                "classroom_id": cid,
                "classroom_name": f"{dept} Sem-{sem} Sec-{sec} Lecture Hall",
                "department": dept,
                "building_id": DEPT_META[dept]["building"],
                "floor_number": 1 if sem in (1, 3) else 2,
                "capacity": 35,
                "equipment": ["SmartBoard", "4K Projector", "Lecture Capture", "PA-System"],
                "power_dependency_id": power_dep,
                "network_dependency_id": "NET-CORE",
                "operational_status": "Operational",
                "source_type": "derived_from_csv",
            }
        )

    # 5. Laboratories (10 derived from CSV) + Lab Equipment
    lab_ids = sorted({s["lab_id"] for s in students})
    laboratories = []
    laboratory_equipment = []
    for lid in lab_ids:
        dept = lid.split("-")[1]
        spec = LAB_SPECS[lid]
        laboratories.append(
            {
                "lab_id": lid,
                "lab_name": spec["name"],
                "department": dept,
                "building_id": DEPT_META[dept]["building"],
                "capacity": 30,
                "workstations": 30,
                "power_dependency_id": spec["power"],
                "network_dependency_id": spec["net"],
                "operational_status": "Operational",
                "source_type": "derived_from_csv",
            }
        )
        for idx, eq_name in enumerate(spec["equip"], start=1):
            laboratory_equipment.append(
                {
                    "equipment_id": f"EQ-{lid}-{idx}",
                    "lab_id": lid,
                    "equipment_name": eq_name,
                    "quantity_total": 30 if idx == 1 else 10,
                    "quantity_operational": 30 if idx == 1 else 10,
                    "requires_power": True,
                    "requires_network": idx == 3,
                    "operational_status": "Operational",
                    "source_type": "synthetic_supporting",
                }
            )

    # 6. Academic Groups (20 derived from CSV)
    group_counts: Counter = Counter()
    group_rooms: Dict[tuple, str] = {}
    group_labs: Dict[tuple, str] = {}
    for s in students:
        key = (s["department"], s["semester"], s["section"])
        group_counts[key] += 1
        group_rooms[key] = s["classroom_id"]
        group_labs[key] = s["lab_id"]

    # Wait: 5 depts * 4 sems * 2 secs = 40 groups!
    academic_groups = []
    for (dept, sem, sec), cnt in sorted(group_counts.items()):
        academic_groups.append(
            {
                "group_id": f"GRP-{dept}-{sem}-{sec}",
                "department": dept,
                "semester": sem,
                "section": sec,
                "student_count": cnt,
                "primary_classroom_id": group_rooms[(dept, sem, sec)],
                "primary_lab_id": group_labs[(dept, sem, sec)],
                "source_type": "derived_from_csv",
            }
        )

    # 7. Subjects & Timetable (synthetic_supporting)
    subjects = []
    for dept in DEPT_META:
        for sem in (1, 3, 5, 7):
            subjects.append(
                {
                    "subject_code": f"{dept}{sem}01",
                    "subject_name": f"{dept} Core Theory {sem}.1",
                    "department": dept,
                    "semester": sem,
                    "requires_lab": False,
                    "required_equipment": ["Projector"],
                    "credits": 4,
                    "source_type": "synthetic_supporting",
                }
            )
            subjects.append(
                {
                    "subject_code": f"{dept}{sem}02L",
                    "subject_name": f"{dept} Applied Lab {sem}.2",
                    "department": dept,
                    "semester": sem,
                    "requires_lab": True,
                    "required_equipment": LAB_SPECS[f"LAB-{dept}-{1 if sem in (1,3) else 2}"]["equip"][:1],
                    "credits": 2,
                    "source_type": "synthetic_supporting",
                }
            )

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    timetable = []
    for idx, grp in enumerate(academic_groups):
        dept = grp["department"]
        sem = grp["semester"]
        sec = grp["section"]
        fac_num = 1 if sec == "A" else 2
        if sem in (5, 7):
            fac_num += 2
        fac_id = f"FAC-{dept}-{fac_num}"
        day = days[idx % len(days)]
        slot_lecture = "09:00-10:00" if sec == "A" else "10:15-11:15"
        slot_lab = "14:00-16:00" if sem in (1, 3) else "11:30-13:30"

        timetable.append(
            {
                "session_id": f"TT-{dept}-{sem}{sec}-LEC",
                "academic_group_id": grp["group_id"],
                "subject_code": f"{dept}{sem}01",
                "faculty_id": fac_id,
                "room_id": grp["primary_classroom_id"],
                "room_type": "Classroom",
                "day_of_week": day,
                "time_slot": slot_lecture,
                "session_type": "Lecture",
                "is_mandatory": True,
                "operational_status": "Scheduled",
                "source_type": "synthetic_supporting",
            }
        )
        timetable.append(
            {
                "session_id": f"TT-{dept}-{sem}{sec}-LAB",
                "academic_group_id": grp["group_id"],
                "subject_code": f"{dept}{sem}02L",
                "faculty_id": fac_id,
                "room_id": grp["primary_lab_id"],
                "room_type": "Laboratory",
                "day_of_week": days[(idx + 1) % len(days)],
                "time_slot": slot_lab,
                "session_type": "Practical",
                "is_mandatory": True,
                "operational_status": "Scheduled",
                "source_type": "synthetic_supporting",
            }
        )

    # Intentional realistic conflict seeds (clearly detectable by conflict engine)
    # 1) Lab double-booking between two groups on Monday 14:00-16:00 in LAB-CSE-1
    timetable.append(
        {
            "session_id": "TT-CSE-3B-LAB-CONF",
            "academic_group_id": "GRP-CSE-3-B",
            "subject_code": "CSE302L",
            "faculty_id": "FAC-CSE-2",
            "room_id": "LAB-CSE-1",
            "room_type": "Laboratory",
            "day_of_week": "Tuesday",
            "time_slot": "14:00-16:00",
            "session_type": "Practical",
            "is_mandatory": True,
            "operational_status": "Scheduled",
            "source_type": "synthetic_supporting",
        }
    )

    # 8. Hostels (35 rooms derived from CSV + occupancy)
    hostel_counts = Counter(s["hostel_room"] for s in students if s["hostel_room"])
    hostel_blocks = [
        {
            "block_id": "HB-NORTH",
            "block_name": "North Scholars Hostel Block",
            "building_id": "BLDG-HOSTEL-N",
            "total_rooms": 20,
            "power_dependency_id": "PWR-HOSTEL",
            "water_dependency_id": "WTR-HOSTEL",
            "operational_status": "Operational",
            "source_type": "synthetic_supporting",
        },
        {
            "block_id": "HB-SOUTH",
            "block_name": "South Engineering Hostel Block",
            "building_id": "BLDG-HOSTEL-S",
            "total_rooms": 15,
            "power_dependency_id": "PWR-HOSTEL",
            "water_dependency_id": "WTR-HOSTEL",
            "operational_status": "Operational",
            "source_type": "synthetic_supporting",
        },
    ]
    hostel_rooms = []
    for idx, room_id in enumerate(sorted(hostel_counts.keys())):
        occ = hostel_counts[room_id]
        block = "HB-NORTH" if idx < 20 else "HB-SOUTH"
        hostel_rooms.append(
            {
                "room_id": room_id,
                "block_id": block,
                "capacity": 2 if occ <= 2 else 3,
                "current_occupancy": occ,
                "operational_status": "Operational",
                "source_type": "derived_from_csv",
            }
        )
    hostel_services = [
        {"service_id": "HSVC-WATER-N", "block_id": "HB-NORTH", "service_name": "Potable Water & Sanitation", "dependency_infra_id": "WTR-HOSTEL", "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"service_id": "HSVC-POWER-N", "block_id": "HB-NORTH", "service_name": "Hostel Lighting & Wi-Fi", "dependency_infra_id": "PWR-HOSTEL", "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"service_id": "HSVC-WATER-S", "block_id": "HB-SOUTH", "service_name": "Potable Water & Sanitation", "dependency_infra_id": "WTR-HOSTEL", "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"service_id": "HSVC-POWER-S", "block_id": "HB-SOUTH", "service_name": "Hostel Lighting & Wi-Fi", "dependency_infra_id": "PWR-HOSTEL", "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]

    # 9. Transportation (5 distinct bus_route values from CSV: BUS-01..BUS-04 + Self)
    route_names = {
        "BUS-01": ("North Ring Road Express", "Yelahanka - Hebbal Corridor", 22.5, True),
        "BUS-02": ("East Tech Corridor", "Whitefield - KR Puram Corridor", 26.0, True),
        "BUS-03": ("Central Metro Shuttle", "MG Road - Majestic Corridor", 14.0, True),
        "BUS-04": ("South Outer Express", "Electronic City - Silk Board Corridor", 24.0, True),
        "Self": ("Independent Commute (Non-Bus)", "Local Campus Proximity", 0.0, False),
    }
    raw_routes = sorted({s["bus_route"] for s in students if s["bus_route"]})
    bus_routes = [
        {
            "route_id": rid,
            "route_name": route_names[rid][0],
            "corridor_area": route_names[rid][1],
            "distance_km": route_names[rid][2],
            "is_college_bus": route_names[rid][3],
            "operational_status": "Operational",
            "source_type": "derived_from_csv",
        }
        for rid in raw_routes
    ]
    drivers = [
        {"driver_id": "DRV-01", "driver_name": "Ramesh Gowda", "license_status": "Active", "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"driver_id": "DRV-02", "driver_name": "Mahesh Nair", "license_status": "Active", "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"driver_id": "DRV-03", "driver_name": "Suresh Reddy", "license_status": "Active", "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"driver_id": "DRV-04", "driver_name": "Venkatesh Rao", "license_status": "Active", "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"driver_id": "DRV-05", "driver_name": "Anil Kumar (Reserve)", "license_status": "Active", "availability_status": "Standby", "source_type": "synthetic_supporting"},
    ]
    buses = [
        {"bus_id": "VEH-BUS-01", "route_id": "BUS-01", "driver_id": "DRV-01", "registration_no": "KA-01-OM-1001", "capacity": 45, "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"bus_id": "VEH-BUS-02", "route_id": "BUS-02", "driver_id": "DRV-02", "registration_no": "KA-01-OM-1002", "capacity": 45, "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"bus_id": "VEH-BUS-03", "route_id": "BUS-03", "driver_id": "DRV-03", "registration_no": "KA-01-OM-1003", "capacity": 40, "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"bus_id": "VEH-BUS-04", "route_id": "BUS-04", "driver_id": "DRV-04", "registration_no": "KA-01-OM-1004", "capacity": 40, "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]

    # 10. Examination Halls & Examinations
    exam_halls = [
        {"hall_id": "HALL-EXAM-1", "hall_name": "Digital Assessment Centre 1", "building_id": "BLDG-EXAM", "capacity": 60, "supports_online_exam": True, "power_dependency_id": "PWR-ACAD-A", "network_dependency_id": "NET-EXAM", "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"hall_id": "HALL-EXAM-2", "hall_name": "Central Examination Hall 2", "building_id": "BLDG-EXAM", "capacity": 60, "supports_online_exam": True, "power_dependency_id": "PWR-ACAD-A", "network_dependency_id": "NET-EXAM", "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"hall_id": "HALL-SEMINAR", "hall_name": "Auditorium & Reserve Exam Hall", "building_id": "BLDG-SEMINAR", "capacity": 150, "supports_online_exam": False, "power_dependency_id": "PWR-ACAD-B", "network_dependency_id": "NET-CORE", "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]
    examinations = [
        {"exam_id": "EXM-CSE-5", "exam_name": "CSE Sem-5 Mid-Term Online Assessment", "subject_code": "CSE501", "department": "CSE", "semester": 5, "hall_id": "HALL-EXAM-1", "invigilator_id": "FAC-CSE-3", "exam_mode": "Online", "day_of_week": "Wednesday", "time_slot": "10:00-12:00", "is_mandatory": True, "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
        {"exam_id": "EXM-ISE-7", "exam_name": "ISE Sem-7 Cloud Capstone Assessment", "subject_code": "ISE701", "department": "ISE", "semester": 7, "hall_id": "HALL-EXAM-2", "invigilator_id": "FAC-ISE-4", "exam_mode": "Online", "day_of_week": "Thursday", "time_slot": "10:00-12:00", "is_mandatory": True, "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
        {"exam_id": "EXM-ECE-3", "exam_name": "ECE Sem-3 Signal Theory Exam", "subject_code": "ECE301", "department": "ECE", "semester": 3, "hall_id": "HALL-SEMINAR", "invigilator_id": "FAC-ECE-2", "exam_mode": "Written", "day_of_week": "Friday", "time_slot": "09:30-11:30", "is_mandatory": True, "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
    ]

    # 11. Placement Drives & Events
    placement_drives = [
        {"drive_id": "PLC-01", "company_name": "Apex Semiconductor Systems", "role_title": "Systems & Firmware Engineer", "venue_id": "VENUE-PLACE-1", "eligible_departments": ["CSE", "ISE", "ECE"], "eligible_semester": 7, "day_of_week": "Thursday", "time_slot": "10:00-13:00", "power_dependency_id": "PWR-ACAD-B", "network_dependency_id": "NET-EXAM", "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
        {"drive_id": "PLC-02", "company_name": "Meridian Infra & Robotics", "role_title": "Graduate Engineer Trainee", "venue_id": "VENUE-PLACE-1", "eligible_departments": ["ME", "CV"], "eligible_semester": 7, "day_of_week": "Friday", "time_slot": "14:00-17:00", "power_dependency_id": "PWR-ACAD-B", "network_dependency_id": "NET-CORE", "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
    ]
    event_venues = [
        {"venue_id": "VENUE-PLACE-1", "venue_name": "Placement & Corporate Interview Wing", "building_id": "BLDG-PLACE", "capacity": 120, "power_dependency_id": "PWR-ACAD-B", "network_dependency_id": "NET-EXAM", "operational_status": "Operational", "source_type": "synthetic_supporting"},
        {"venue_id": "VENUE-SEMINAR-1", "venue_name": "Main Innovation Seminar Hall", "building_id": "BLDG-SEMINAR", "capacity": 220, "power_dependency_id": "PWR-ACAD-B", "network_dependency_id": "NET-CORE", "operational_status": "Operational", "source_type": "synthetic_supporting"},
    ]
    events = [
        {"event_id": "EVT-01", "event_name": "National AI & Digital Twin Symposium", "event_category": "Technical", "venue_id": "VENUE-SEMINAR-1", "target_department": "CSE", "day_of_week": "Friday", "time_slot": "09:30-11:30", "expected_participants": 140, "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
        {"event_id": "EVT-02", "event_name": "Industry Readiness Workshop", "event_category": "Workshop", "venue_id": "VENUE-PLACE-1", "target_department": "ISE", "day_of_week": "Wednesday", "time_slot": "15:00-17:00", "expected_participants": 60, "operational_status": "Scheduled", "source_type": "synthetic_supporting"},
    ]

    # 12. Backup Resources & Maintenance Records
    backup_resources = [
        {"backup_id": "BKP-GEN-01", "backup_name": "Activate 350kVA Diesel Generator (North Grid)", "resource_type": "BackupGenerator", "primary_resource_id": "PWR-ACAD-A", "capacity": 350, "activation_minutes": 8, "estimated_cost": 4200.0, "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"backup_id": "BKP-GEN-02", "backup_name": "Activate 250kVA Diesel Generator (South/Hostel Grid)", "resource_type": "BackupGenerator", "primary_resource_id": "PWR-ACAD-B", "capacity": 250, "activation_minutes": 10, "estimated_cost": 3500.0, "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"backup_id": "BKP-NET-4G", "backup_name": "Switch to Secondary ISP + 5G Campus Failover", "resource_type": "Network", "primary_resource_id": "NET-CORE", "capacity": 10, "activation_minutes": 5, "estimated_cost": 1800.0, "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"backup_id": "BKP-HALL-SEM", "backup_name": "Relocate Sessions to Main Seminar Hall", "resource_type": "Hall", "primary_resource_id": "HALL-EXAM-1", "capacity": 150, "activation_minutes": 20, "estimated_cost": 1200.0, "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"backup_id": "BKP-BUS-SPARE", "backup_name": "Deploy Reserve Shuttle Bus + Standby Driver", "resource_type": "Transport", "primary_resource_id": "BUS-01", "capacity": 45, "activation_minutes": 25, "estimated_cost": 2600.0, "availability_status": "Available", "source_type": "synthetic_supporting"},
        {"backup_id": "BKP-WATER-TANKER", "backup_name": "Emergency Campus Water Tanker Supply", "resource_type": "Water", "primary_resource_id": "WTR-HOSTEL", "capacity": 60000, "activation_minutes": 35, "estimated_cost": 3000.0, "availability_status": "Available", "source_type": "synthetic_supporting"},
    ]

    maintenance_records = [
        {"resource_id": "LAB-ME-2", "resource_type": "Laboratory", "scheduled_start": "2026-11-26T09:00:00Z", "scheduled_end": "2026-11-26T12:00:00Z", "description": "Preventive DAQ sensor calibration", "status": "Scheduled", "source_type": "synthetic_supporting"},
        {"resource_id": "GEN-01", "resource_type": "BackupGenerator", "scheduled_start": "2026-11-24T08:00:00Z", "scheduled_end": "2026-11-24T10:00:00Z", "description": "Load bank test passed at 94% fuel", "status": "Completed", "source_type": "synthetic_supporting"},
    ]

    return {
        "csv_report": csv_report,
        "students": students,
        "departments": departments,
        "academic_groups": academic_groups,
        "faculty": faculty,
        "subjects": subjects,
        "infrastructure": infrastructure,
        "power_supply": power_supply,
        "backup_generators": backup_generators,
        "network_resources": network_resources,
        "water_supply": water_supply,
        "classrooms": classrooms,
        "laboratories": laboratories,
        "laboratory_equipment": laboratory_equipment,
        "timetable": timetable,
        "hostel_blocks": hostel_blocks,
        "hostel_rooms": hostel_rooms,
        "hostel_services": hostel_services,
        "bus_routes": bus_routes,
        "drivers": drivers,
        "buses": buses,
        "exam_halls": exam_halls,
        "examinations": examinations,
        "placement_drives": placement_drives,
        "event_venues": event_venues,
        "events": events,
        "backup_resources": backup_resources,
        "maintenance_records": maintenance_records,
    }


def summarize_local_dataset() -> Dict[str, Any]:
    """Build and summarize the institutional dataset locally for FastAPI."""
    data = build_institutional_dataset()
    return {
        "status": "prepared_locally",
        "counts": {k: len(v) for k, v in data.items() if isinstance(v, list)},
        "message": "Supporting resource dataset built & validated locally for FastAPI.",
    }


if __name__ == "__main__":
    print(json.dumps(summarize_local_dataset(), indent=2))
