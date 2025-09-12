
"use server";

import { z } from "zod";
import { validateEmail, type ValidateEmailInput } from "@/ai/flows/validate-email-flow";

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
