# Mealie `In possession` implementation note

The current Mealie API does not expose a dedicated `onHand` or `inPossession` field for foods. In practice, the UI checkbox is driven by the household relationship on the food:

- Read from `householdsWithIngredientFood` on `GET /api/foods/{id}`
- Write by adding or removing the current `householdSlug` in `PUT /api/foods/{id}`

Observed behavior in the connected Mealie instance:

- Toggling the checkbox changes `households_to_ingredient_foods`
- The legacy database column `ingredient_foods.on_hand` does not change and is not treated as authoritative
- `updatedAt` does not reliably change when the checkbox is toggled

Consequences for this app:

- The sync uses the current user's `householdSlug` from `GET /api/users/self`
- Delta sync tracks the last desired possession state in the app's own sync state instead of relying on Mealie timestamps
- A manual full reconcile endpoint exists to correct manual Mealie edits immediately
