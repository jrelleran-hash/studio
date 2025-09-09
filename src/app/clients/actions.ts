
"use server";

import {
  importClientsFromSheet,
  type ImportClientsInput,
} from "@/ai/flows/smart-search-mvp";
import { getGoogleAuthUrl } from "@/services/google-auth-service";
import { z } from "zod";

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

export async function getGoogleAuthUrlAction(): Promise<string> {
  return getGoogleAuthUrl();
}
