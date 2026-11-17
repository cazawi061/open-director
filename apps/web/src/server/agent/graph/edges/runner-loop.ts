
import type { RunnerTask } from "@/server/agent/media-provider";

export function afterUpdateAndContinue(state: {
  runnerTasks: RunnerTask[];
  mediaAssets: Record<string, unknown>[];
}): string {
  return "update_state";
}
