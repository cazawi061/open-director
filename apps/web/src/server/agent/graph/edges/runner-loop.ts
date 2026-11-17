
import type { RunnerTask } from "@/server/agent/media-provider";

export function afterUpdateAndContinue(state: {
  runnerTasks: RunnerTask[];
  mediaAssets: Record<string, unknown>[];
}): string {
  const completedAssetCount = state.mediaAssets.length;
  const totalTasks = state.runnerTasks.length;

  if (completedAssetCount < totalTasks) {
    return "runner_executor";
  }

  return "update_state";
}
