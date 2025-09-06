// src/ai/flows/smart-search-mvp.ts
'use server';

/**
 * @fileOverview Smart search MVP flow that leverages an LLM to interpret search queries and return relevant results.
 *
 * - smartSearch - A function that handles the smart search process.
 * - SmartSearchInput - The input type for the smartSearch function.
 * - SmartSearchOutput - The return type for the smartSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { addCustomer } from '@/services/data-service';

const SmartSearchInputSchema = z.object({
  query: z.string().describe('The user search query in natural language.'),
});
export type SmartSearchInput = z.infer<typeof SmartSearchInputSchema>;

const SmartSearchOutputSchema = z.object({
  results: z.string().describe('The relevant search results based on the query.'),
});
export type SmartSearchOutput = z.infer<typeof SmartSearchOutputSchema>;

export async function smartSearch(input: SmartSearchInput): Promise<SmartSearchOutput> {
  return smartSearchFlow(input);
}

const smartSearchPrompt = ai.definePrompt({
  name: 'smartSearchPrompt',
  input: {schema: SmartSearchInputSchema},
  output: {schema: SmartSearchOutputSchema},
  prompt: `You are a smart search assistant. Use the user's query to find relevant information.

User Query: {{{query}}}

Return the relevant search results in a concise manner.`,
});

const smartSearchFlow = ai.defineFlow(
  {
    name: 'smartSearchFlow',
    inputSchema: SmartSearchInputSchema,
    outputSchema: SmartSearchOutputSchema,
  },
  async input => {
    const {output} = await smartSearchPrompt(input);
    return output!;
  }
);


const CustomerSchema = z.object({
  projectName: z.string(),
  clientName: z.string(),
  boqNumber: z.string(),
  address: z.string(),
});

const ImportCustomersInputSchema = z.object({
  sheetUrl: z.string().url().describe("The public URL of the Google Sheet to import customer data from."),
});
export type ImportCustomersInput = z.infer<typeof ImportCustomersInputSchema>;

const ImportCustomersOutputSchema = z.object({
  importedCount: z.number().describe("The number of customers successfully imported."),
  errors: z.array(z.string()).describe("A list of errors that occurred during the import process."),
});
export type ImportCustomersOutput = z.infer<typeof ImportCustomersOutputSchema>;

const importCustomersPrompt = ai.definePrompt({
    name: 'importCustomersPrompt',
    input: { schema: z.object({ sheetData: z.string() }) },
    output: { schema: z.object({ customers: z.array(CustomerSchema) }) },
    prompt: `You are a data processing assistant. Your task is to parse the provided text, which represents data from a spreadsheet, and convert it into a structured JSON array of customers. The spreadsheet columns are: Project Name, Client Name, BOQ Number, Address.

    Spreadsheet Data:
    {{{sheetData}}}

    Extract the data for each customer and format it according to the schema.
    `,
});

const importCustomerTool = ai.defineTool(
    {
        name: 'saveCustomers',
        description: 'Saves a list of new customers to the database.',
        inputSchema: z.object({
            customers: z.array(CustomerSchema),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            importedCount: z.number(),
        }),
    },
    async ({ customers }) => {
        let importedCount = 0;
        for (const customer of customers) {
            try {
                await addCustomer(customer);
                importedCount++;
            } catch (e) {
                console.error(`Failed to import customer: ${customer.clientName}`, e);
            }
        }
        return { success: true, importedCount };
    }
);


const importCustomersFlow = ai.defineFlow(
  {
    name: 'importCustomersFlow',
    inputSchema: ImportCustomersInputSchema,
    outputSchema: ImportCustomersOutputSchema,
  },
  async (input) => {
    // In a real application, you would fetch the data from the sheetUrl.
    // For this example, we'll use mock data that matches the expected format.
    const mockSheetData = `
      Project Alpha,John Doe,BOQ-001,123 Main St
      Project Beta,Jane Smith,BOQ-002,456 Oak Ave
      Project Gamma,Sam Wilson,BOQ-003,789 Pine Ln
    `;

    const { output } = await importCustomersPrompt({ sheetData: mockSheetData });
    if (!output || !output.customers) {
      return { importedCount: 0, errors: ["Failed to parse customer data."] };
    }

    const result = await importCustomerTool({ customers: output.customers });

    return {
      importedCount: result.importedCount,
      errors: [],
    };
  }
);


export async function importCustomersFromSheet(input: ImportCustomersInput): Promise<ImportCustomersOutput> {
  return importCustomersFlow(input);
}
