"""OMNIS-X Authoritative Student Dataset Importer.

Reads data/omnis_x_200_students(1).csv using Pandas, validates schema, uniqueness,
numeric bounds, and missing data rules, and converts NaN to JSON-compatible None.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import CSV_PATH

EXPECTED_COLUMNS: List[str] = [
    "student_id",
    "usn",
    "student_name",
    "department",
    "semester",
    "section",
    "email",
    "attendance_percent",
    "cgpa",
    "classroom_id",
    "lab_id",
    "mentor_id",
    "residence_type",
    "hostel_room",
    "bus_route",
    "exam_status",
    "placement_status",
    "student_status",
]


def _clean_optional_str(val: Any) -> Optional[str]:
    if pd.isna(val):
        return None
    text = str(val).strip()
    return text if text else None


def _clean_optional_float(val: Any) -> Optional[float]:
    if pd.isna(val):
        return None
    return round(float(val), 2)


def validate_and_prepare_students(
    csv_path: Path = CSV_PATH,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Load, validate, and normalize the authoritative 200-student CSV dataset."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Authoritative student CSV not found at: {csv_path}")

    df = pd.read_csv(csv_path, keep_default_na=True)
    actual_columns = list(df.columns)
    if actual_columns != EXPECTED_COLUMNS:
        raise ValueError(
            f"CSV schema mismatch. Expected {EXPECTED_COLUMNS}, got {actual_columns}"
        )

    errors: List[str] = []
    if df["student_id"].isna().any() or not df["student_id"].is_unique:
        errors.append("student_id must be non-null and unique across all rows.")
    if df["usn"].isna().any() or not df["usn"].is_unique:
        errors.append("usn must be non-null and unique across all rows.")

    attendance = pd.to_numeric(df["attendance_percent"], errors="coerce")
    if attendance.isna().any() or ((attendance < 0) | (attendance > 100)).any():
        errors.append("attendance_percent contains invalid or out-of-range values (0..100).")

    cgpa = pd.to_numeric(df["cgpa"], errors="coerce")
    valid_cgpa = cgpa.dropna()
    if ((valid_cgpa < 0) | (valid_cgpa > 10)).any():
        errors.append("cgpa contains out-of-range values (0..10).")

    if errors:
        raise ValueError("Validation failed: " + "; ".join(errors))

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        records.append(
            {
                "student_id": str(row["student_id"]).strip(),
                "usn": str(row["usn"]).strip(),
                "student_name": str(row["student_name"]).strip(),
                "department": str(row["department"]).strip(),
                "semester": int(row["semester"]),
                "section": str(row["section"]).strip(),
                "email": str(row["email"]).strip(),
                "attendance_percent": round(float(row["attendance_percent"]), 2),
                "cgpa": _clean_optional_float(row["cgpa"]),
                "classroom_id": str(row["classroom_id"]).strip(),
                "lab_id": str(row["lab_id"]).strip(),
                "mentor_id": str(row["mentor_id"]).strip(),
                "residence_type": str(row["residence_type"]).strip(),
                "hostel_room": _clean_optional_str(row["hostel_room"]),
                "bus_route": _clean_optional_str(row["bus_route"]),
                "exam_status": str(row["exam_status"]).strip(),
                "placement_status": str(row["placement_status"]).strip(),
                "student_status": str(row["student_status"]).strip(),
                "source_type": "imported_csv",
            }
        )

    report: Dict[str, Any] = {
        "csv_file": str(csv_path),
        "validated_at_utc": datetime.now(timezone.utc).isoformat(),
        "total_rows": len(records),
        "unique_student_ids": int(df["student_id"].nunique()),
        "unique_usns": int(df["usn"].nunique()),
        "departments": int(df["department"].nunique()),
        "semesters": sorted(df["semester"].unique().tolist()),
        "sections": sorted(df["section"].unique().tolist()),
        "classrooms": int(df["classroom_id"].nunique()),
        "laboratories": int(df["lab_id"].nunique()),
        "mentors": int(df["mentor_id"].nunique()),
        "hostel_rooms": int(df["hostel_room"].dropna().nunique()),
        "bus_routes": int(df["bus_route"].dropna().nunique()),
        "missing_values_preserved_as_null": {
            "cgpa": int(df["cgpa"].isna().sum()),
            "hostel_room": int(df["hostel_room"].isna().sum()),
            "bus_route": int(df["bus_route"].isna().sum()),
        },
        "cgpa_valid_observations": int(valid_cgpa.shape[0]),
        "cgpa_mean_valid_only": round(float(np.mean(valid_cgpa)), 3) if len(valid_cgpa) else None,
        "schema_valid": True,
    }
    return records, report


def run_import() -> Dict[str, Any]:
    """Validate CSV locally for the FastAPI digital twin backend."""
    _, report = validate_and_prepare_students()
    report["status"] = "validated_locally"
    report["message"] = "CSV validated successfully (200 records) for FastAPI local digital twin mode."
    return report


if __name__ == "__main__":
    result = run_import()
    print(json.dumps(result, indent=2))
