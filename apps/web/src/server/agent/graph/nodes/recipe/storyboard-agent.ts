
import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import type { DirectorState } from "../../state";
import { storyboardOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { storyboardAgentPrompt } from "../prompts/storyboard";

import {
  createModel,
  sendAgentProgress,
  mergeRecipe,
  resolveLanguage,
  languageInstruction,
  callStructuredWithRetry,
} from "./shared";

import type { SSEWriter } from "../../sse-writer";

export async function storyboardAgentNode(
  state: typeof DirectorState.State,
  config?: {
    configurable?: {
      writer?: SSEWriter;
    };
  },
) {
  const writer = config?.configurable?.writer;

  console.log("[storyboard_agent] starting");

  sendAgentProgress(
    writer,
    "storyboard_agent",
    "running",
  );

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;

    const lang = resolveLanguage(
      state.directorBrief as
        | Record<string, unknown>
        | undefined,
      r.language as string | undefined,
    );

    const llm = createModel().withStructuredOutput(
      storyboardOutputSchema,
      {
        name: "generate_storyboard",
      },
    );

    const context = [
      `Full Story: ${String(r.fullStory || "N/A")}`,
      `Art Style: ${
        r.artStyle
          ? JSON.stringify(r.artStyle)
          : "N/A"
      }`,
      `User brief: ${state.goal || ""}`,
    ].join("\n\n");

    const schemaInstructions = `
CRITICAL JSON OUTPUT RULES:

Return a valid JSON object that strictly matches
the provided output schema.

Every scene must contain valid shots.

For every shot:
- title MUST be a single string.
- title MUST NOT be an array.
- title MUST NOT be an object.
- Use a short descriptive title.
- Do not return multiple title alternatives.
- Do not add unsupported properties.

Correct example:
"title": "A child playing in the garden"

Incorrect example:
"title": ["A child", "Playing in the garden"]

Keep the storyboard concise.
Do not generate unnecessary scenes or shots.
Follow the output schema exactly.
`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<
        typeof callStructuredWithRetry
      >[0],
      [
        new SystemMessage(
          storyboardAgentPrompt("story") +
            languageInstruction(lang) +
            "\n\n" +
            schemaInstructions,
        ),
        new HumanMessage(context),
      ],
      "storyboard_agent",
      writer,
      (chunk) => {
        writer?.write(
          "recipe",
          mergeRecipe(
            recipe,
            chunk as Record<string, unknown>,
          ),
        );
      },
    );

    const updated = mergeRecipe(
      recipe,
      partial as Record<string, unknown>,
    );

    const scenes = (
      updated as Record<string, unknown>
    ).scenes as unknown[] | undefined;

    console.log(
      "[storyboard_agent] completed, scenes:",
      scenes?.length ?? 0,
    );

    sendAgentProgress(
      writer,
      "storyboard_agent",
      "completed",
    );

    return {
      recipe: updated,
      currentStep: "storyboard_agent",
      error: "",
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : String(err);

    console.error(
      "[storyboard_agent] failed:",
      message,
    );

    sendAgentProgress(
      writer,
      "storyboard_agent",
      "failed",
      {
        error: message,
      },
    );

    // Stop the graph immediately after failure.
    // Do not continue to character/location/voice agents.
    throw err;
  }
}
