import type { ProjectWorkspaceMode } from './projectTypes';

interface ProjectWorkspaceProps {
  mode: ProjectWorkspaceMode;
}

export default function ProjectWorkspace({ mode }: ProjectWorkspaceProps) {
  const isAdminMode = mode === 'admin';

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
          Operations
        </p>

        <div className="mt-4 max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground md:text-4xl">
            Projects
          </h1>

          <p className="text-sm leading-6 text-muted-foreground md:text-base">
            The old Projects workspace UI has been removed so this page can be rebuilt from a clean canvas.
            Existing project records, finance records, tasks, cost estimates, and timeline source data are not modified here.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-dashed border-border/80 bg-background/60 p-6 md:p-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Reset In Progress
          </p>

          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Project workspace rebuild starts from here.
          </h2>

          <p className="text-sm leading-6 text-muted-foreground">
            {isAdminMode
              ? 'Admin project access remains available at the route level, but detailed project and finance entry UI has intentionally been removed from this page.'
              : 'Portal project access remains available at the route level, but detailed project and finance entry UI has intentionally been removed from this page.'}
          </p>

          <p className="text-sm leading-6 text-muted-foreground">
            Finance data entry will move to the dedicated Finance / Project Finance workspace later. This page should only become a project overview and navigation surface after the redesign.
          </p>
        </div>
      </section>
    </div>
  );
}
