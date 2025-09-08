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
import { addClient } from '@/services/data-service';

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


const ClientSchema = z.object({
  projectName: z.string(),
  clientName: z.string(),
  boqNumber: z.string(),
  address: z.string(),
});

const ImportClientsInputSchema = z.object({
  sheetUrl: z.string().url().describe("The public URL of the Google Sheet to import client data from."),
});
export type ImportClientsInput = z.infer<typeof ImportClientsInputSchema>;

const ImportClientsOutputSchema = z.object({
  importedCount: z.number().describe("The number of clients successfully imported."),
  errors: z.array(z.string()).describe("A list of errors that occurred during the import process."),
});
export type ImportClientsOutput = z.infer<typeof ImportClientsOutputSchema>;

const importClientsPrompt = ai.definePrompt({
    name: 'importClientsPrompt',
    input: { schema: z.object({ sheetData: z.string() }) },
    output: { schema: z.object({ clients: z.array(ClientSchema) }) },
    prompt: `You are a data processing assistant. Your task is to parse the provided text, which represents data from a spreadsheet, and convert it into a structured JSON array of clients. The spreadsheet columns are: Project Name, Client Name, BOQ Number, Address.

    Spreadsheet Data:
    {{{sheetData}}}

    Extract the data for each client and format it according to the schema.
    `,
});

const importClientTool = ai.defineTool(
    {
        name: 'saveClients',
        description: 'Saves a list of new clients to the database.',
        inputSchema: z.object({
            clients: z.array(ClientSchema),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            importedCount: z.number(),
        }),
    },
    async ({ clients }) => {
        let importedCount = 0;
        for (const client of clients) {
            try {
                await addClient(client);
                importedCount++;
            } catch (e) {
                console.error(`Failed to import client: ${client.clientName}`, e);
            }
        }
        return { success: true, importedCount };
    }
);


const importClientsFlow = ai.defineFlow(
  {
    name: 'importClientsFlow',
    inputSchema: ImportClientsInputSchema,
    outputSchema: ImportClientsOutputSchema,
  },
  async (input) => {
    // In a real application, you would fetch the data from the sheetUrl.
    // For this example, we'll use mock data that matches the expected format.
    const mockSheetData = `
      Project Alpha,John Doe,BOQ-001,123 Main St
      Project Beta,Jane Smith,BOQ-002,456 Oak Ave
      Project Gamma,Sam Wilson,BOQ-003,789 Pine Ln
    `;

    const { output } = await importClientsPrompt({ sheetData: mockSheetData });
    if (!output || !output.clients) {
      return { importedCount: 0, errors: ["Failed to parse client data."] };
    }

    const result = await importClientTool({ clients: output.clients });

    return {
      importedCount: result.importedCount,
      errors: [],
    };
  }
);


export async function importClientsFromSheet(input: ImportClientsInput): Promise<ImportClientsOutput> {
  return importClientsFlow(input);
}
