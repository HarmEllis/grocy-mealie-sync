import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function createUserTextPrompt(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text,
        },
      },
    ],
  };
}

export function registerCorePrompts(server: McpServer) {
  server.registerPrompt(
    'create-new-product',
    {
      title: 'Create New Product',
      description: 'Guide a safe product creation flow in Grocy, Mealie, or both systems',
      argsSchema: {
        name: z.string().trim().min(1).optional(),
        target: z.enum(['grocy', 'mealie', 'both']).optional(),
      },
    },
    async ({ name, target }) => {
      const requestedName = name ? ` for "${name}"` : '';
      const requestedTarget = target ? ` Target system: ${target}.` : '';

      return createUserTextPrompt(
        `Create a new product${requestedName} through the grocy-mealie-sync MCP server.${requestedTarget}

First call products.check_duplicates before any write. If exact duplicates exist, stop and summarize them instead of mutating.
If the product already exists in Mealie but not Grocy, prefer products.create_grocy followed by mappings.upsert_product instead of creating a duplicate in Mealie.
If you need unit context, inspect units.list_catalog or mappings.suggest_units. Only use existing Grocy units, never guess a grocyUnitId, and stop to ask the user if the correct unit is not clearly verified.
Use products.create_grocy, products.create_mealie, or products.create_in_both only after the duplicate check is clear and the target system is explicit.
After any create or mapping write, prefer the returned productRef for follow-up actions instead of inventing bare ids or names. Summarize the created Grocy id, Mealie id, canonical productRef, and whether a mapping was stored.`,
      );
    },
  );

  server.registerPrompt(
    'review-unmapped-items',
    {
      title: 'Review Unmapped Items',
      description: 'Review unmapped products and units and propose the next safe mapping actions',
    },
    async () => createUserTextPrompt(
      `Review the current unmapped items through the grocy-mealie-sync MCP server.

Start with gms://products/unmapped and gms://units/unmapped.
Then use mappings.suggest_products and mappings.suggest_units to propose likely matches.
If the best next action is clear, explain which mappings.upsert_product or mappings.upsert_unit calls should be made, but do not mutate until the choice is explicit.`,
    ),
  );

  server.registerPrompt(
    'diagnose-product-state',
    {
      title: 'Diagnose Product State',
      description: 'Explain why one product currently looks the way it does across Grocy, Mealie, and the sync app',
      argsSchema: {
        productRef: z.string().trim().min(1),
      },
    },
    async ({ productRef }) => createUserTextPrompt(
      `Diagnose the current state for product reference "${productRef}" through the grocy-mealie-sync MCP server.

Use diagnostics.explain_product_state as the primary explanation tool.
Also inspect products.get_overview for the raw combined product state.
If needed, cross-check conflicts.list and gms://history/recent to explain recent sync side effects.
Return a concise explanation of the active mapping, stock state, and any open conflicts before proposing a write.`,
    ),
  );

  server.registerPrompt(
    'process-shopping-fix',
    {
      title: 'Process Shopping Fix',
      description: 'Review one shopping-list issue and choose the safest corrective action',
      argsSchema: {
        query: z.string().trim().min(1).optional(),
        foodId: z.string().trim().min(1).optional(),
      },
    },
    async ({ query, foodId }) => {
      const identifier = foodId
        ? `foodId "${foodId}"`
        : query
          ? `query "${query}"`
          : 'the reported shopping-list issue';

      return createUserTextPrompt(
        `Review ${identifier} on the Mealie shopping list through the grocy-mealie-sync MCP server.

Start with shopping.list_items for current context.
Then use shopping.check_product to verify whether the target item already exists and whether duplicates are present.
Use shopping.add_item with the query parameter for descriptive product phrases such as "vanille kwark" so the leading words can be moved into the note when that is the only exact-safe resolution. Use foodId when you already have the Mealie food id from a previous tool call.
Only use shopping.add_item, shopping.remove_item, or shopping.merge_duplicates after you can explain exactly why that action is correct.
Summarize the duplicate logic and the intended final shopping-list state before mutating.`,
      );
    },
  );

  server.registerPrompt(
    'apply-stock-correction',
    {
      title: 'Apply Stock Correction',
      description: 'Turn a natural-language stock correction into one safe inventory action',
      argsSchema: {
        productRef: z.string().trim().min(1),
        instruction: z.string().trim().min(1),
      },
    },
    async ({ productRef, instruction }) => createUserTextPrompt(
      `Apply the stock correction "${instruction}" for product reference "${productRef}" through the grocy-mealie-sync MCP server.

Inspect products.get_overview and inventory.get_stock first.
Choose exactly one of inventory.add_stock, inventory.consume_stock, inventory.set_stock, inventory.mark_opened, inventory.delete_entry, inventory.create_entry, or inventory.update_entry based on the user's intent.
Use inventory.delete_entry when the user wants to remove a specific stock entry.
Use inventory.create_entry when the user wants to add stock with specific entry-level fields (purchased date, location, open state).
Use inventory.update_entry when the user wants to modify fields on an existing entry.
Prefer canonical productRef values returned by prior tool calls; do not fall back to bare ids or names when a returned productRef is available.
If the instruction is ambiguous, explain the ambiguity and stop instead of guessing.
After the action, summarize what changed, including quantity, best-before data, and opened state if relevant.`,
    ),
  );
}
