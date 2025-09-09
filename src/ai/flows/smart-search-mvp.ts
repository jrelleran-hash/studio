
// src/ai/flows/smart-search-mvp.ts
'use server';

/**
 * @fileOverview Smart search MVP flow that leverages an LLM to interpret search queries and return relevant results.
 *
 * - smartSearch - A function that handles the smart search process.
 * - smartSearch - A function that handles the smart search process.
 * - SmartSearchInput - The input type for the smartSearch function.
 * - SmartSearchOutput - The return type for the smartSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { addClient } from '@/services/data-service';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/services/google-auth-service';

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
    try {
        const sheetId = extractSheetIdFromUrl(input.sheetUrl);
        if (!sheetId) {
            return { importedCount: 0, errors: ["Invalid Google Sheet URL."] };
        }

        const oauth2Client = getAuthenticatedClient();
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Sheet1!A1:D', // Default to Sheet1 and range A:D
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return { importedCount: 0, errors: ["No data found in the sheet."] };
        }

        const sheetData = rows.map(row => row.join(',')).join('\n');
        
        const { output } = await importClientsPrompt({ sheetData });

        if (!output || !output.clients) {
          return { importedCount: 0, errors: ["Failed to parse client data."] };
        }

        const result = await importClientTool({ clients: output.clients });

        return {
          importedCount: result.importedCount,
          errors: [],
        };
    } catch (e: any) {
        console.error("Error during import:", e);
        // Check for specific Google API errors
        if (e.code === 403) {
            return { importedCount: 0, errors: ["Permission denied. Make sure the bot has access to the Google Sheet."] };
        }
        if (e.code === 404) {
            return { importedCount: 0, errors: ["Google Sheet not found. Please check the URL."] };
        }
        return { importedCount: 0, errors: ["An error occurred while fetching data from Google Sheets."] };
    }
  }
);

function extractSheetIdFromUrl(url: string): string | null {
    const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(url);
    return match ? match[1] : null;
}


export async function importClientsFromSheet(input: ImportClientsInput): Promise<ImportClientsOutput> {
  return importClientsFlow(input);
}
