
"use server";

import {
  importClientsFromSheet,
  type ImportClientsInput,
} from "@/ai/flows/import-clients-flow";
import { getGoogleAuthUrl } from "@/services/google-auth-service";
import { z } from "zod";
import { validateEmail, type ValidateEmailInput } from "@/ai/flows/validate-email-flow";

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


const ValidateEmailInputSchema = z.object({
  email: z.string().email(),
});

export async function validateEmailAction(input: ValidateEmailInput): Promise<{
    isValid: boolean;
    reason?: string;
    error?: string;
}> {
    const parsedInput = ValidateEmailInputSchema.safeParse(input);
    if (!parsedInput.success) {
        return { isValid: false, error: "Invalid email format." };
    }
    
    try {
        const output = await validateEmail(parsedInput.data);
        return { isValid: output.isValid, reason: output.reason };
    } catch (error) {
        console.error("Email validation failed:", error);
        return { isValid: false, error: "An unexpected error occurred during validation." };
    }
}
