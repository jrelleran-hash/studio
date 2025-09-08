"use server";

import {
  smartSearch,
  type SmartSearchInput,
  importClientsFromSheet,
  type ImportClientsInput,
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

const ImportClientsInputSchema = z.object({
  sheetUrl: z.string().url(),
});

export async function importClientsAction(
  input: ImportClientsInput
): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const parsedInput = ImportClientsInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const output = await importClientsFromSheet(parsedInput.data);
    if (output.errors.length > 0) {
      return { success: false, error: output.errors.join(", ") };
    }
    return { success: true, importedCount: output.importedCount };
  } catch (error) {
    console.error("Client import failed:", error);
    return { success: false, error: "An unexpected error occurred during import." };
  }
}
