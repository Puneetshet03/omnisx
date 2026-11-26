-- OMNIS-X Seed Baseline Configuration
-- Note: Authoritative 200 student records must be imported via backend/import_students.py
-- and supporting synthetic institutional resources via backend/seed_resources.py.

INSERT INTO public.settings (setting_key, setting_value)
VALUES
    ('health_weights', '{"academic_continuity": 0.25, "resource_availability": 0.20, "exam_readiness": 0.15, "transport_reliability": 0.10, "hostel_stability": 0.10, "infrastructure_stability": 0.12, "conflict_penalty": 0.08}'::jsonb),
    ('institution_profile', '{"name": "OMNIS-X Engineering Institute", "project_id": "A01", "tagline": "Predict. Prevent. Recover."}'::jsonb)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
