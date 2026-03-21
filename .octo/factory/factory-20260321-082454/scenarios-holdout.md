# Factory Holdout Scenarios (6 of 31)

### Scenario 3: Fuzzy or alias match resolves minor naming differences
**Behavior:** B1.4, B1.3  
**Type:** edge-case  
**Given:** Mealie contains food `Bell Pepper`; Grocy contains product `Paprika`; an alias or fuzzy-match rule is configured to treat them as equivalent; no mapping exists.  
**When:** The sync runs.  
**Then:** The service links the Mealie food to the existing Grocy product instead of creating a new Grocy product.  
**Verification:** PASS if no new Grocy product is created, the mapping is persisted to `Paprika`, and the sync output/log records a link decision rather than a create decision.


### Scenario 8: Newly checked Mealie item adds stock in Grocy and clears Grocy shopping list item
**Behavior:** B3.1, B3.2, B3.4; Detection 4.2  
**Type:** happy-path  
**Given:** Mealie shopping list poll at `t0` shows item `item-1` unchecked; poll at `t1` shows the same item checked with quantity `2`; mapping exists to Grocy product `101`; Grocy shopping list contains a matching item for product `101`.  
**When:** The service processes the `t1` Mealie shopping list response.  
**Then:** It detects the false→true transition, calls Grocy `/api/stock/products/101/add` with quantity `2`, and deletes the corresponding Grocy shopping list item.  
**Verification:** PASS if one Grocy add-stock call and one Grocy delete-shopping-list call are issued, stock increases by `2`, and the Grocy shopping list item is removed.


### Scenario 13: Downstream API failure is retried safely without duplicate effects
**Behavior:** B2.2 or B3.2, B3.4  
**Type:** error-handling  
**Given:** A valid sync action is ready; the first call to Mealie add-item or Grocy add-stock returns HTTP 500 or times out; the endpoint succeeds on retry.  
**When:** The service executes its retry logic.  
**Then:** The mutation is eventually applied once, duplicate list items or duplicate stock additions are not created, and the failure plus retry outcome are recorded.  
**Verification:** PASS if the final external state reflects one successful mutation, retry attempts are observable, and no duplicate side effects exist.


### Scenario 3: Handling Name Conflicts with Existing Grocy Products
**Behavior:** B1.4
**Type:** edge-case
**Given:** Mealie has a food "Banana". Grocy already has a product named "Banana", but no mapping currently exists between them.
**When:** The sync process runs.
**Then:** A new product is NOT created in Grocy. A mapping is created linking the Mealie "Banana" ID to the existing Grocy "Banana" ID.
**Verification:** Verify the Grocy product count for "Banana" remains exactly 1. Verify the new mapping is created in the Sync DB.


### Scenario 8: Mealie Check-off Triggers Grocy Stock Addition
**Behavior:** B3.1, B3.2, B3.4
**Type:** happy-path
**Given:** "Flour" is mapped. It is on the Mealie shopping list with a quantity of 1. It is also on the Grocy shopping list.
**When:** A user checks off "Flour" in the Mealie shopping list. The Sync service polls Mealie.
**Then:** The Sync Service adds 1 unit of "Flour" to Grocy stock via `/api/stock/products/{id}/add`. It then removes the item from the Grocy shopping list via a `DELETE` request.
**Verification:** Query Grocy stock for "Flour" to ensure stock increased by 1. Query the Grocy shopping list to verify "Flour" was removed.


### Scenario 13: Grocy API Unreachable During Polling
**Behavior:** 4.1
**Type:** error-handling
**Given:** The Grocy server goes offline (returns 502/503 or times out).
**When:** The Sync Service attempts its short-interval poll of the Grocy volatile endpoint.
**Then:** The Sync Service catches the connection error, logs the failure, and gracefully waits for the next polling interval without crashing.
**Verification:** Simulate Grocy downtime. Verify the sync service process stays alive and standard output contains the appropriate error logs.


