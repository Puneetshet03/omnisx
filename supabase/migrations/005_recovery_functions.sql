-- OMNIS-X Migration 005: Atomic RPC Functions for Recovery & Simulation

CREATE OR REPLACE FUNCTION public.apply_recovery_plan_atomic(
    p_plan_id UUID,
    p_actor_id TEXT,
    p_actor_role TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_action RECORD;
    v_applied_count INTEGER := 0;
BEGIN
    SELECT * INTO v_plan FROM public.recovery_plans WHERE plan_id = p_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recovery plan % not found', p_plan_id;
    END IF;

    UPDATE public.recovery_plans
    SET approval_status = 'Applied'
    WHERE plan_id = p_plan_id;

    FOR v_action IN
        SELECT * FROM public.recovery_actions WHERE plan_id = p_plan_id
    LOOP
        UPDATE public.infrastructure
        SET operational_status = 'Recovering', updated_at = NOW()
        WHERE infra_id = v_action.target_resource_id;

        UPDATE public.laboratories
        SET operational_status = 'Recovering', updated_at = NOW()
        WHERE lab_id = v_action.target_resource_id;

        UPDATE public.classrooms
        SET operational_status = 'Recovering', updated_at = NOW()
        WHERE classroom_id = v_action.target_resource_id;

        v_applied_count := v_applied_count + 1;
    END LOOP;

    INSERT INTO public.institutional_health (
        overall_score, academic_continuity, resource_availability,
        exam_readiness, transport_reliability, hostel_stability,
        infrastructure_stability, recovery_readiness, context_label
    ) VALUES (
        v_plan.post_recovery_health,
        LEAST(100, v_plan.post_recovery_health + 2),
        v_plan.post_recovery_health,
        v_plan.post_recovery_health,
        95.0,
        95.0,
        v_plan.post_recovery_health,
        96.0,
        'post_recovery'
    );

    INSERT INTO public.notifications (title, message, severity, category)
    VALUES (
        'Recovery Plan Applied',
        format('Plan %s (%s) applied with %s recovery actions.', v_plan.plan_label, v_plan.strategy_name, v_applied_count),
        'Info',
        'Recovery'
    );

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, details)
    VALUES (
        p_actor_id,
        p_actor_role,
        'APPLY_RECOVERY_PLAN',
        'recovery_plans',
        p_plan_id::TEXT,
        jsonb_build_object(
            'plan_label', v_plan.plan_label,
            'strategy_name', v_plan.strategy_name,
            'actions_applied', v_applied_count,
            'post_recovery_health', v_plan.post_recovery_health
        )
    );

    RETURN jsonb_build_object(
        'status', 'applied',
        'plan_id', p_plan_id,
        'actions_applied', v_applied_count,
        'post_recovery_health', v_plan.post_recovery_health
    );
END;
$$;
