Todo:
- [ ] Sync Units from Mealie to Grocy by retrieving the list of units from Mealie and creating or updating each unit in Grocy
- [ ] Sync product groups from Mealie to Grocy by retrieving the list of product groups from Mealie and creating or updating each product group in Grocy
- [ ] Sync products from Mealie to Grocy by retrieving the list of products from Mealie and creating or updating each product in Grocy
- [ ] Setup notification endpoint for the following notifications from Mealie
    - [ ] Added item to grocerylist
    - [ ] Updated item in grocerylist
    - [ ] Removed item from grocerylist
- [ ] Sync new Units ot products groups when an item is added or updated in the grocery list
- [ ] Sync the Grocy shopping list items with/ to Mealie by checking every 30 seconds if the shopping list in Grocy has changed
    - [ ] Save extra information in the extras json object attribute on a shopping list item in Mealie for each item from Grocy that was added or updated in Grocy to prevent adding duplicates
- [ ] When an item is added or updated in the grocery list in mealie, check the current stock for that item in Grocy and mark it as checked with a note that the product is in stock

Done:
