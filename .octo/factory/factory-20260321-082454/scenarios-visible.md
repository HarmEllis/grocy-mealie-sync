# Factory Visible Scenarios (25 of 31)

### Scenario 1: Initial product and unit sync creates missing Grocy entities
**Behavior:** B1.1, B1.2, B1.3  
**Type:** happy-path  
**Given:** Mealie contains food `Tomato Passata` with ID `food-1` and unit `bottle` with ID `unit-1`; Grocy has no product named `Tomato Passata` and no quantity unit matching `bottle`; the mapping store is empty.  
**When:** The periodic Mealie-to-Grocy sync runs.  
**Then:** The service creates a Grocy product for `Tomato Passata`, creates a Grocy quantity unit for `bottle`, and persists one product mapping and one unit mapping linking the Mealie IDs to the Grocy IDs.  
**Verification:** PASS if Grocy product and quantity unit exist exactly once, and the mapping store contains the expected Mealie↔Grocy ID pairs with non-null `createdAt` and `updatedAt`.


### Scenario 2: Existing Grocy product is linked instead of duplicated on name match
**Behavior:** B1.1, B1.4, B1.3  
**Type:** happy-path  
**Given:** Mealie contains food `Milk`; Grocy already contains product `Milk`; no mapping exists yet for either record.  
**When:** The sync runs.  
**Then:** The service links the Mealie food to the existing Grocy product and does not create a second Grocy product named `Milk`.  
**Verification:** PASS if Grocy still has only one `Milk` product and the mapping table contains a single link between the Mealie food ID and the existing Grocy product ID.


### Scenario 4: Periodic re-sync picks up manual additions from Mealie
**Behavior:** B1.5, B1.1, B1.2  
**Type:** integration  
**Given:** The sync interval is left at default; the last successful sync completed; after that, a user manually adds food `Oats` and unit `bag` in Mealie.  
**When:** The next scheduled re-sync executes after the default interval.  
**Then:** The new Mealie food and unit are created or linked in Grocy and mapped without manual intervention.  
**Verification:** PASS if the scheduler triggers at 6-hour default cadence and the newly added Mealie entities appear in Grocy after the next run.


### Scenario 5: Newly missing Grocy product is detected from volatile polling and added to Mealie
**Behavior:** B2.1, B2.2; Detection 4.1  
**Type:** happy-path  
**Given:** Product mapping exists for Grocy product `101` ↔ Mealie food `food-milk`; Grocy volatile poll at `t0` shows no missing product `101`; poll at `t1` shows `missing_products: [{ id: 101, name: "Milk", amount_missing: 2, is_partly_in_stock: false }]`; the target Mealie shopping list has no unchecked `Milk` item.  
**When:** The service processes the `t1` volatile response.  
**Then:** It detects product `101` as newly below minimum and adds one unchecked Mealie shopping list item for `Milk` with quantity `2` using the mapped unit.  
**Verification:** PASS if exactly one add call is sent to Mealie for `food-milk` with quantity `2`, and the item appears once on the configured Mealie shopping list.


### Scenario 6: Existing unchecked Mealie item is updated instead of duplicated
**Behavior:** B2.2, B2.3  
**Type:** happy-path  
**Given:** Mapping exists for Grocy product `101` ↔ Mealie food `food-milk`; Mealie shopping list already contains an unchecked `Milk` item with quantity `1`; Grocy volatile poll reports `amount_missing: 3` for product `101`.  
**When:** The service syncs the new missing-product state.  
**Then:** The existing unchecked Mealie item is updated to quantity `3` rather than creating a second unchecked `Milk` item.  
**Verification:** PASS if the list still contains one unchecked `Milk` item and its quantity becomes `3`.


### Scenario 7: Grocy shopping list remains untouched during Grocy-to-Mealie sync
**Behavior:** B2.4  
**Type:** integration  
**Given:** Grocy’s native logic has already added product `101` to Grocy shopping list after stock fell below minimum; the sync service detects the same missing product and adds it to Mealie.  
**When:** The Grocy-to-Mealie sync completes.  
**Then:** The existing Grocy shopping list item is not modified or deleted by the sync service.  
**Verification:** PASS if the Grocy shopping list item remains present and unchanged after sync, while the Mealie item is added or updated as expected.


### Scenario 9: Unit conversion is applied before adding stock in Grocy
**Behavior:** B3.2, B3.3  
**Type:** happy-path  
**Given:** Mealie item `Sugar` is checked with quantity `1` in unit `kg`; mapping exists to Grocy product `202` whose stock unit is `g`; Grocy QU conversion table defines `1 kg = 1000 g`.  
**When:** The checked Mealie item is synced to Grocy.  
**Then:** The service converts the quantity and calls Grocy add-stock with `1000 g` or the equivalent converted payload expected by the API.  
**Verification:** PASS if the outgoing Grocy request uses the converted quantity and Grocy stock increases by the correct equivalent amount.


### Scenario 10: Missing mapping prevents side effects and surfaces an actionable error
**Behavior:** B2.2, B3.2, B1.3  
**Type:** error-handling  
**Given:** A Grocy missing product or a checked Mealie item is detected for a product with no mapping in the persistent mapping table.  
**When:** The sync service attempts to process the event.  
**Then:** It does not create a Mealie item or add Grocy stock, records the failure with the unmapped product identifiers, and marks the sync result as partially failed.  
**Verification:** PASS if no downstream API mutation occurs, the error is logged/observable with product IDs, and the service remains running.


### Scenario 11: Repeated polling of the same missing product is idempotent
**Behavior:** B2.1, B2.3; Detection 4.1  
**Type:** edge-case  
**Given:** Grocy volatile endpoint returns the same `missing_products` entry for product `101` with `amount_missing: 2` in three consecutive polls; Mealie already has the synced unchecked item after the first poll.  
**When:** The second and third polls are processed.  
**Then:** No duplicate Mealie items are created and no unnecessary quantity churn occurs if the deficit is unchanged.  
**Verification:** PASS if only the first poll causes a create or update, later polls produce no additional mutations, and the Mealie list still has one unchecked item with quantity `2`.


### Scenario 12: Checked-state transition is processed exactly once
**Behavior:** B3.1; Detection 4.2  
**Type:** edge-case  
**Given:** Poll `t0` shows Mealie item `item-1` unchecked, poll `t1` shows it checked, and poll `t2` still shows it checked.  
**When:** The service processes `t1` and `t2`.  
**Then:** Stock is added only once in response to the false→true transition at `t1`; no second stock addition occurs at `t2`.  
**Verification:** PASS if there is exactly one add-stock call for `item-1` across both polls and Grocy stock increases only once.


### Scenario 14: Unauthorized API credentials block sync and do not leak secrets
**Behavior:** Integration across all API-backed behaviors  
**Type:** non-functional  
**Given:** The service is configured with an invalid Mealie or Grocy API token; debug logging is enabled.  
**When:** A poll or mutation request is attempted and the API returns HTTP 401/403.  
**Then:** The service records an authentication failure, performs no follow-up mutations for that cycle, and does not write the raw token value to logs.  
**Verification:** PASS if logs/telemetry show auth failure without secret disclosure, and neither shopping list nor stock state changes.


### Scenario 15: Polling and sync complete within the configured cadence under load
**Behavior:** B1.5; Detection 4.1, 4.2  
**Type:** non-functional  
**Given:** Grocy volatile response contains 500 missing products and the Mealie shopping list contains 2,000 items; polling is configured at 30 seconds for Grocy and Mealie.  
**When:** The service runs one full poll-and-diff cycle for both systems.  
**Then:** The cycle completes before the next scheduled poll, memory usage remains bounded, and no events are skipped or processed twice because of overlap.  
**Verification:** PASS if measured cycle duration stays below 30 seconds, resource usage stays within agreed limits, and item/product counts in the resulting mutations match the diff input exactly.
</external-cli-output>

## Additional Scenarios (Cross-Provider)

<external-cli-output provider="gemini" trust="untrusted">
Here are 16 test scenarios derived from the NLSpec, covering happy-path, edge cases, error handling, integration, and non-functional requirements.


### Scenario 1: Initial Sync of Mealie Foods to Grocy
**Behavior:** B1.1, B1.3
**Type:** happy-path
**Given:** A new Mealie food "Apple" exists. No corresponding product exists in Grocy.
**When:** The periodic sync process runs.
**Then:** A new product "Apple" is created in Grocy. A mapping is stored in the sync service database linking the Mealie "Apple" ID to the new Grocy "Apple" ID.
**Verification:** Query the Grocy API for product "Apple" and verify its existence. Query the Sync DB and verify the bidirectional mapping exists.


### Scenario 2: Initial Sync of Mealie Units to Grocy
**Behavior:** B1.2, B1.3
**Type:** happy-path
**Given:** A new Mealie unit "Piece" (abbreviation "pc") exists. No corresponding quantity unit exists in Grocy.
**When:** The periodic sync process runs.
**Then:** A new quantity unit "Piece" is created in Grocy. A mapping is stored linking the Mealie unit ID to the Grocy quantity unit ID.
**Verification:** Query the Grocy API for the quantity unit "Piece" and verify its existence. Query the Sync DB and verify the unit mapping.


### Scenario 4: Periodic Re-sync Captures New Additions
**Behavior:** B1.5
**Type:** happy-path
**Given:** The sync service is running normally. A user manually adds a new food "Carrot" in Mealie between sync intervals.
**When:** The configurable product sync interval (e.g., 6 hours) elapses.
**Then:** "Carrot" is detected, synced to Grocy as a new product, and mapped in the database.
**Verification:** Check the Grocy API for "Carrot" and the Sync DB for the mapping after the interval elapses.


### Scenario 5: Grocy Consume Triggers Mealie Shopping List Addition
**Behavior:** B2.1, B2.2
**Type:** happy-path
**Given:** Product "Milk" is mapped between Mealie and Grocy. Grocy min_stock is 2. Current stock is 2.
**When:** A user consumes 1 "Milk" in Grocy, dropping the stock to 1. The Sync Service polls Grocy's volatile endpoint.
**Then:** The Sync Service detects a deficit of 1. It adds 1 unit of "Milk" to the configured Mealie shopping list.
**Verification:** Query the Mealie shopping list API and verify "Milk" is present with a quantity of 1.


### Scenario 6: Avoid Duplicates on Mealie Shopping List
**Behavior:** B2.3
**Type:** edge-case
**Given:** Product "Eggs" is mapped. Grocy min_stock is 12. Current stock is 6. "Eggs" (qty: 6) is already on the Mealie shopping list (unchecked).
**When:** A user consumes 2 more "Eggs" in Grocy, dropping the stock to 4 (deficit is now 8). The Sync Service polls Grocy.
**Then:** The Sync Service updates the existing Mealie shopping list item for "Eggs" to a quantity of 8, rather than creating a duplicate entry.
**Verification:** Query the Mealie shopping list API and verify exactly one "Eggs" item exists with a quantity of 8.


### Scenario 7: Grocy Shopping List Behavior Unchanged
**Behavior:** B2.4
**Type:** integration
**Given:** Product "Bread" drops below minimum stock in Grocy.
**When:** The sync service detects this deficit and adds "Bread" to the Mealie shopping list.
**Then:** The item is ALSO present on Grocy's native shopping list (Grocy's internal behavior remains intact).
**Verification:** Query both the Mealie and Grocy shopping list APIs; the item should exist on both lists.


### Scenario 9: Handle Unit Conversion During Restock
**Behavior:** B3.3
**Type:** edge-case
**Given:** "Rice" is mapped. The Mealie unit is "kg", while the Grocy base unit is "grams" (with a conversion factor defined). "Rice" (qty: 2 kg) is checked off in Mealie.
**When:** The Sync service polls and processes the check-off event.
**Then:** The Sync Service adds stock to Grocy using the correct quantity/unit payload (e.g., passing the specific QU ID for 'kg' or the converted value in grams).
**Verification:** Query Grocy stock and verify it increased by the equivalent of 2 kg.


### Scenario 10: Item Checked Off in Mealie but No Mapping Exists
**Behavior:** B3.1, B3.2
**Type:** error-handling
**Given:** An unmapped item "Mystery Sauce" is manually added to the Mealie shopping list and checked off by the user.
**When:** The Sync service polls Mealie and detects the newly checked item.
**Then:** The Sync Service logs a warning/error about a missing mapping, skips the Grocy stock addition, and does not crash.
**Verification:** Check the sync service logs for the missing mapping warning. Verify Grocy stock levels remain unchanged.


### Scenario 11: Rapid Successive Consume Events in Grocy
**Behavior:** 4.1
**Type:** edge-case
**Given:** Product "Coffee" is mapped and currently at min_stock.
**When:** A user consumes 1 "Coffee", and then 10 seconds later consumes another 1 "Coffee". The Sync Service polling interval is 30 seconds.
**Then:** On the next poll, the Sync Service processes the aggregated deficit (2) and updates the Mealie list with a quantity of 2 in a single operation.
**Verification:** Query the Mealie shopping list and verify "Coffee" has a quantity of 2, with no duplicate list items created.


### Scenario 12: Unchecking an Item in Mealie (Undo)
**Behavior:** B3.1
**Type:** edge-case
**Given:** "Butter" was previously checked off in Mealie, and the sync service already added the stock to Grocy.
**When:** A user unchecks "Butter" in Mealie (moving it back to the active list).
**Then:** The Sync Service ignores the state change from `true` to `false` (does not deduct stock from Grocy, preventing destructive loops).
**Verification:** Verify Grocy stock for "Butter" remains unchanged. Verify the item is back on the active Mealie list.


### Scenario 14: Mealie API Unreachable During Polling
**Behavior:** 4.2
**Type:** error-handling
**Given:** The Mealie server goes offline.
**When:** The Sync Service attempts its short-interval poll of the Mealie shopping list endpoint.
**Then:** The Sync Service catches the connection error, logs the failure, and gracefully waits for the next polling interval.
**Verification:** Simulate Mealie downtime. Verify the sync service process stays alive and standard output contains the appropriate error logs.


### Scenario 15: Full Cycle Integration Validation
**Behavior:** B2.1, B2.2, B3.1, B3.2, B3.4
**Type:** integration
**Given:** "Pasta" is mapped. Current Stock = 1, Min Stock = 2.
**When:** 
1. User consumes 1 "Pasta" in Grocy (Stock = 0).
2. Sync service polls Grocy -> adds to Mealie list (Deficit = 2).
3. User checks off "Pasta" in Mealie.
4. Sync service polls Mealie -> adds 2 to Grocy stock & deletes from Grocy list.
**Then:** Final state: Grocy stock is 2. The Mealie list has "Pasta" checked off. The Grocy shopping list does not contain "Pasta".
**Verification:** Perform API calls sequentially matching the steps above, verifying state at each boundary.


### Scenario 16: Polling Execution Overlap Prevention
**Behavior:** 4.1, 4.2
**Type:** non-functional
**Given:** A slow network response causes the Grocy poll processing to take 45 seconds, while the polling interval is set to 30 seconds.
**When:** The 30-second timer triggers the next poll while the first one is still executing.
**Then:** The Sync Service skips the new poll or acquires a lock, preventing concurrent execution of the sync logic and avoiding race conditions or duplicate additions.
**Verification:** Artificially delay the Grocy API response to exceed the polling interval. Check logs to confirm the overlapping poll was skipped or deferred.
</external-cli-output>

