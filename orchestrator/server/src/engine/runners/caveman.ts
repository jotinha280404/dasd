import { emitRunnerIteration, finishRun, type RunnerCtx, runDagPass } from "./dag";

/**
 * The `caveman` runner strategy: brute-force re-invoke. Run the same DAG pass
 * up to `maxIterations` times; the run succeeds as soon as any agent result of
 * a pass contains `doneMarker`. Between passes the previous combined result is
 * fed back into every agent prompt (capped at 500 chars when `compressContext`
 * is set, 4000 otherwise). Exhausting the loop without the marker is an error.
 */

const PREVIOUS_CAP = 4000;
const PREVIOUS_CAP_COMPRESSED = 500;

export async function runCaveman(ctx: RunnerCtx): Promise<void> {
  const { graph, record } = ctx;
  const runner = graph.settings.runner;
  const cap = runner.compressContext ? PREVIOUS_CAP_COMPRESSED : PREVIOUS_CAP;
  let previous = "";

  for (let i = 1; i <= runner.maxIterations; i += 1) {
    if (ctx.isCanceled()) return;

    record.iteration = i;
    ctx.publish();
    emitRunnerIteration(record, "caveman", i, runner.maxIterations, `attempt ${i}`);

    const opts = previous
      ? { promptSuffix: `\n\n## Previous attempt\n${previous.slice(0, cap)}` }
      : {};
    const pass = await runDagPass(ctx, opts);
    if (ctx.isCanceled()) return;

    if (!pass.ok) {
      finishRun(ctx, "error");
      return;
    }
    if (pass.texts.some((t) => t.includes(runner.doneMarker))) {
      finishRun(ctx, "success");
      return;
    }
    previous = pass.combinedText;
  }

  finishRun(ctx, "error");
}
