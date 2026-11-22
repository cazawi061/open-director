
import type { DirectorState } from "../../state";
import type {
  ResearchNotes,
} from "@/server/agent/schemas/research";
import { sendAgentProgress } from "./shared";
import type { SSEWriter } from "../../sse-writer";

export function shouldResearchForGoal(
  _goal: string,
  _directorBrief?: Record<string, unknown>,
): boolean {
  return false;
}

export function buildResearchQuery(
  goal: string,
  _directorBrief?: Record<string, unknown>,
): string {
  return goal.trim();
}

export function parseResearchResponseText(
  _text: string,
  query: string,
): ResearchNotes {
  return {
    shouldResearch: false,
    query,
    notes: [],
    cautions: [],
    sources: [],
  };
}

export function formatResearchNotesForScript(
  research: ResearchNotes | undefined,
): string {
  if (!research?.shouldResearch) return "";

  const notes = (research.notes || [])
    .slice(0, 5)
    .map((note) => `- ${note}`)
    .join("\n");

  return notes
    ? `Reference notes:\n${notes}`
    : "";
}

export async function researchAgentNode(
  _state: typeof DirectorState.State,
  config?: {
    configurable?: {
      writer?: SSEWriter;
    };
  },
) {
  const writer = config?.configurable?.writer;

  sendAgentProgress(
    writer,
    "research_agent",
    "running",
  );

  const research: ResearchNotes = {
    shouldResearch: false,
    notes: [],
    cautions: [],
    sources: [],
  };

  sendAgentProgress(
    writer,
    "research_agent",
    "completed",
    {
      skipped: true,
      reason: "External research temporarily disabled",
    },
  );

  return {
    research,
    currentStep: "research_agent",
  };
}
