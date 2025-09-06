"use server";

import {
  smartSearch,
  type SmartSearchInput,
} from "@/ai/flows/smart-search-mvp";
import { z } from "zod";

const SmartSearchInputSchema = z.object({
  query: z.string(),
});

export async function smartSearchAction(
  input: SmartSearchInput
): Promise<{ success: boolean; results?: string; error?: string }> {
  const parsedInput = SmartSearchInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const output = await smartSearch(parsedInput.data);
    return { success: true, results: output.results };
  } catch (error) {
    console.error("Smart search failed:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
