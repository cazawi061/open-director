
import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import type { DirectorState } from "../../state";
import { scriptOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { scriptAgentPrompt } from "../prompts/script";

import {
  createModel,
  sendAgentProgress,
  mergeRecipe,
  resolveLanguage,
  languageInstruction,
  callStructuredWithRetry,
} from "./shared";

import { formatResearchNotesForScript } from "./research-agent";
import type { SSEWriter } from "../../sse-writer";

export async function scriptAgentNode(
  state: typeof DirectorState.State,
  config?: {
    configurable?: {
      writer?: SSEWriter;
    };
  },
) {
  const writer = config?.configurable?.writer;

  console.log(
    "[script_agent] starting:",
    state.goal?.slice(0, 80),
  );

  sendAgentProgress(
    writer,
    "script_agent",
    "running",
  );

  try {
    const lang = resolveLanguage(
      state.directorBrief as
        | Record<string, unknown>
        | undefined,
      undefined,
    );

    const llm = createModel().withStructuredOutput(
      scriptOutputSchema,
      {
        name: "generate_script",
      },
    );

    const systemPrompt =
      scriptAgentPrompt("story") +
      languageInstruction(lang);

    const userPrompt = [
      `User brief: ${state.goal}`,
      formatResearchNotesForScript(state.research),
    ]
      .filter(Boolean)
      .join("\n\n");

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<
        typeof callStructuredWithRetry
      >[0],
      [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ],
      "script_agent",
      writer,
      (chunk) => {
        writer?.write(
          "recipe",
          mergeRecipe(
            state.recipe,
            chunk as Record<string, unknown>,
          ),
        );
      },
    );

    const recipe = mergeRecipe(
      state.recipe,
      partial as Record<string, unknown>,
    );

    console.log(
      "[script_agent] completed:",
      (recipe as Record<string, unknown>).title,
    );

    sendAgentProgress(
      writer,
      "script_agent",
      "completed",
    );

    return {
      recipe,
      currentStep: "script_agent",
      error: "",
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : String(err);

    console.error(
      "[script_agent] failed:",
      message,
    );

    sendAgentProgress(
      writer,
      "script_agent",
      "failed",
      { error: message },
    );

    // Stop the graph instead of continuing
    // to other agents after a failed script.
    throw err;
  }
}
