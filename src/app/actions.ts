"use server";

import {
  smartSearch,
  type SmartSearchInput,
  importCustomersFromSheet,
  type ImportCustomersInput,
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

const ImportCustomersInputSchema = z.object({
  sheetUrl: z.string().url(),
});

export async function importCustomersAction(
  input: ImportCustomersInput
): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const parsedInput = ImportCustomersInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const output = await importCustomersFromSheet(parsedInput.data);
    if (output.errors.length > 0) {
      return { success: false, error: output.errors.join(", ") };
    }
    return { success: true, importedCount: output.importedCount };
  } catch (error) {
    console.error("Customer import failed:", error);
    return { success: false, error: "An unexpected error occurred during import." };
  }
}
