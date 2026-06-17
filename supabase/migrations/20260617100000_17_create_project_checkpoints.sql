-- 17. Project checkpoint foundation
-- Adds stage-gated project checkpoints for site visit, design, execution, QC, and handover.

CREATE TABLE IF NOT EXISTS public.project_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  checkpoint_key text NOT NULL CHECK (
    checkpoint_key IN (
      'initial_site_visit',
      'design_phase',
      'execution',
      'quality_control',
      'handover'
    )
  ),

  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'locked' CHECK (
    status IN ('locked', 'available', 'in_progress', 'completed', 'skipped')
  ),

  sort_order integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT true,

  notes text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id, checkpoint_key)
);

CREATE INDEX IF NOT EXISTS idx_project_checkpoints_project_id
  ON public.project_checkpoints(project_id);

CREATE INDEX IF NOT EXISTS idx_project_checkpoints_status
  ON public.project_checkpoints(status);

DROP TRIGGER IF EXISTS trg_project_checkpoints_updated_at ON public.project_checkpoints;
CREATE TRIGGER trg_project_checkpoints_updated_at
  BEFORE UPDATE ON public.project_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read project checkpoints"
  ON public.project_checkpoints;

CREATE POLICY "Authenticated users can read project checkpoints"
  ON public.project_checkpoints
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Project operators can manage project checkpoints"
  ON public.project_checkpoints;

CREATE POLICY "Project operators can manage project checkpoints"
  ON public.project_checkpoints
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('super_admin', 'admin')
          OR EXISTS (
            SELECT 1
            FROM public.departments d
            WHERE d public.project_checkpoints
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
     .id = ANY(COALESCE(p.department_ids, '{}'::uuid[]))
              AND (
                d.code IN ('DE', 'OQ', 'PL')
                OR d.name IN (
                  'Designing & Execution',
                  'Ops. & Quality Control',
                  'Procurement & Logistics'
                )
              )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('super_admin', 'admin')
          OR EXISTS (
            SELECT 1
            FROM public.departments d
            WHERE d.id = ANY(COALESCE(p.department_ids, '{}'::uuid[]))
              AND (
                d.code IN ('DE', 'OQ', 'PL')
                OR d.name IN (
                  'Designing & Execution',
                  'Ops. & Quality Control',
                  'Procurement & Logistics'
                )
              )
          )
        )
    )
  );
