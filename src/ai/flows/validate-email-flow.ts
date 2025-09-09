
'use server';
/**
 * @fileOverview A flow for validating an email address.
 *
 * - validateEmail - A function that handles the email validation process.
 * - ValidateEmailInput - The input type for the validateEmail function.
 * - ValidateEmailOutput - The return type for the validateEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ValidateEmailInputSchema = z.object({
  email: z.string().describe('The email address to validate.'),
});
export type ValidateEmailInput = z.infer<typeof ValidateEmailInputSchema>;

const ValidateEmailOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the email is likely to be valid and deliverable.'),
  reason: z.string().describe('A brief explanation of the validation result.'),
});
export type ValidateEmailOutput = z.infer<typeof ValidateEmailOutputSchema>;


const validateEmailPrompt = ai.definePrompt({
  name: 'validateEmailPrompt',
  input: { schema: ValidateEmailInputSchema },
  output: { schema: ValidateEmailOutputSchema },
  prompt: `You are an expert in email deliverability and syntax. Your task is to analyze the provided email address and determine if it is likely to be a valid, existing, and deliverable email address.

Consider the following:
- Syntactical correctness (e.g., presence of '@', valid characters).
- Plausibility of the domain (e.g., is it a known disposable email provider? Does the domain have valid MX records - you can infer this based on common knowledge of popular domains like gmail.com, outlook.com, etc.).
- Common typos in popular domains.

Email to validate: {{{email}}}

Provide your response in the specified JSON format. For the 'reason' field, provide a concise, one-sentence explanation. For example: "The domain appears valid and the format is correct." or "The domain 'gmial.com' seems to have a typo."
`,
});


const validateEmailFlow = ai.defineFlow(
  {
    name: 'validateEmailFlow',
    inputSchema: ValidateEmailInputSchema,
    outputSchema: ValidateEmailOutputSchema,
  },
  async (input) => {
    // Basic format check to avoid unnecessary API calls for clearly invalid emails
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
        return { isValid: false, reason: "The email format is invalid." };
    }
    const { output } = await validateEmailPrompt(input);
    return output!;
  }
);


export async function validateEmail(
  input: ValidateEmailInput
): Promise<ValidateEmailOutput> {
  return validateEmailFlow(input);
}
