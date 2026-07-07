import * as projects from "../../store/projects";
import { emitRunnerIteration, failRun, finishRun, type RunnerCtx, runDagPass } from "./dag";

/**
 * The `ralph` runner strategy: loop-until-backlog-done. Each iteration picks
 * the next backlog item of the configured project (a stale `doing` item first,
 * to resume interrupted runs, else the first `todo`), marks it `doing`, runs
 * one DAG pass with the item appended to every agent prompt, then marks it
 * `done` (or back to `todo` on failure). Ends success when the backlog is
 * empty; ends error when `maxIterations` is exhausted with items remaining.
 */
export async function runRalph(ctx: RunnerCtx): Promise<void> {
  const { graph, record } = ctx;
  const runner = graph.settings.runner;
  const projectId = runner.projectId;
  if (!projectId) {
    failRun(ctx, "ralph runner requires settings.runner.projectId");
    return;
  }
  const initial = await projects.get(projectId);
  if (!initial) {
    failRun(ctx, `ralph runner: project ${projectId} not found`);
    return;
  }
  record.projectId = projectId;

  for (let i = 1; i <= runner.maxIterations; i += 1) {
    if (ctx.isCanceled()) return;

    const project = await projects.get(projectId);
    if (!project) {
      failRun(ctx, `ralph runner: project ${projectId} disappeared mid-run`);
      return;
    }
    const item =
      project.items.find((it) => it.status === "doing") ??
      project.items.find((it) => it.status === "todo");
    if (!item) {
      finishRun(ctx, "success");
      return;
    }

    await projects.setItemStatus(projectId, item.id, "doing");
    record.iteration = i;
    ctx.publish();
    emitRunnerIteration(record, "ralph", i, runner.maxIterations, item.title);

    const suffix = `\n\n## Current backlog item (iteration ${i})\n${item.title}\n${item.description}\nComplete ONLY this item, then stop.`;
    const pass = await runDagPass(ctx, { promptSuffix: suffix });
    if (ctx.isCanceled()) return;

    if (pass.ok) {
      await projects.setItemStatus(projectId, item.id, "done", i);
    } else {
      await projects.setItemStatus(projectId, item.id, "todo");
      finishRun(ctx, "error");
      return;
    }
  }

  // Iterations exhausted — error if anything is still not done.
  const final = await projects.get(projectId);
  const remaining = final === null || final.items.some((it) => it.status !== "done");
  finishRun(ctx, remaining ? "error" : "success");
}
