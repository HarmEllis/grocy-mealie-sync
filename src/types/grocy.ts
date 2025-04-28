import { z } from "zod";

export type Product = z.infer<typeof Product>;
export const Product = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  location_id: z.number().optional(),
  qu_id_purchase: z.number().optional(),
  qu_id_stock: z.number().optional(),
  enable_tare_weight_handling: z.number().optional(),
  not_check_stock_fulfillment_for_recipes: z.number().optional(),
  product_group_id: z.number().optional(),
  tare_weight: z.number().optional(),
  min_stock_amount: z.number().optional(),
  default_best_before_days: z.number().optional(),
  default_best_before_days_after_open: z.number().optional(),
  picture_file_name: z.string().optional(),
  row_created_timestamp: z.string().optional(),
  shopping_location_id: z.number().optional(),
  treat_opened_as_out_of_stock: z.number().optional(),
  auto_reprint_stock_label: z.number().optional(),
  no_own_stock: z.number().optional(),
  userfields: z.unknown().optional(),
  should_not_be_frozen: z.number().optional(),
  default_consume_location_id: z.number().optional(),
  move_on_open: z.number().optional(),
});

export type ProductWithoutUserfields = z.infer<typeof ProductWithoutUserfields>;
export const ProductWithoutUserfields = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  location_id: z.number().optional(),
  qu_id_purchase: z.number().optional(),
  qu_id_stock: z.number().optional(),
  enable_tare_weight_handling: z.number().optional(),
  not_check_stock_fulfillment_for_recipes: z.number().optional(),
  product_group_id: z.number().optional(),
  tare_weight: z.number().optional(),
  min_stock_amount: z.number().optional(),
  default_best_before_days: z.number().optional(),
  default_best_before_days_after_open: z.number().optional(),
  picture_file_name: z.string().optional(),
  row_created_timestamp: z.string().optional(),
  shopping_location_id: z.number().optional(),
  treat_opened_as_out_of_stock: z.number().optional(),
  auto_reprint_stock_label: z.number().optional(),
  no_own_stock: z.number().optional(),
  should_not_be_frozen: z.number().optional(),
  default_consume_location_id: z.number().optional(),
  move_on_open: z.number().optional(),
});

export type QuantityUnit = z.infer<typeof QuantityUnit>;
export const QuantityUnit = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  name_plural: z.string().optional(),
  description: z.string().optional(),
  row_created_timestamp: z.string().optional(),
  plural_forms: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type Location = z.infer<typeof Location>;
export const Location = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  row_created_timestamp: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type ShoppingLocation = z.infer<typeof ShoppingLocation>;
export const ShoppingLocation = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  row_created_timestamp: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type StockLocation = z.infer<typeof StockLocation>;
export const StockLocation = z.object({
  id: z.number().optional(),
  product_id: z.number().optional(),
  amount: z.number().optional(),
  location_id: z.number().optional(),
  location_name: z.string().optional(),
  location_is_freezer: z.number().optional(),
});

export type StockEntry = z.infer<typeof StockEntry>;
export const StockEntry = z.object({
  id: z.number().optional(),
  product_id: z.number().optional(),
  location_id: z.number().optional(),
  shopping_location_id: z.number().optional(),
  amount: z.number().optional(),
  best_before_date: z.string().optional(),
  purchased_date: z.string().optional(),
  stock_id: z.string().optional(),
  price: z.number().optional(),
  open: z.number().optional(),
  opened_date: z.string().optional(),
  note: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type RecipeFulfillmentResponse = z.infer<typeof RecipeFulfillmentResponse>;
export const RecipeFulfillmentResponse = z.object({
  recipe_id: z.number().optional(),
  need_fulfilled: z.boolean().optional(),
  need_fulfilled_with_shopping_list: z.boolean().optional(),
  missing_products_count: z.number().optional(),
  costs: z.number().optional(),
});

export type ProductBarcode = z.infer<typeof ProductBarcode>;
export const ProductBarcode = z.object({
  product_id: z.number().optional(),
  barcode: z.string().optional(),
  qu_id: z.number().optional(),
  shopping_location_id: z.number().optional(),
  amount: z.number().optional(),
  last_price: z.number().optional(),
  note: z.string().optional(),
});

export type ProductDetailsResponse = z.infer<typeof ProductDetailsResponse>;
export const ProductDetailsResponse = z.object({
  product: Product.optional(),
  product_barcodes: z.array(ProductBarcode).optional(),
  quantity_unit_stock: QuantityUnit.optional(),
  default_quantity_unit_purchase: QuantityUnit.optional(),
  default_quantity_unit_consume: QuantityUnit.optional(),
  quantity_unit_price: QuantityUnit.optional(),
  last_purchased: z.string().optional(),
  last_used: z.string().optional(),
  stock_amount: z.number().optional(),
  stock_amount_opened: z.number().optional(),
  next_due_date: z.string().optional(),
  last_price: z.number().optional(),
  avg_price: z.number().optional(),
  current_price: z.number().optional(),
  oldest_price: z.number().optional(),
  last_shopping_location_id: z.number().optional(),
  location: Location.optional(),
  average_shelf_life_days: z.number().optional(),
  spoil_rate_percent: z.number().optional(),
  has_childs: z.boolean().optional(),
  default_location: Location.optional(),
  qu_conversion_factor_purchase_to_stock: z.number().optional(),
  qu_conversion_factor_price_to_stock: z.number().optional(),
});

export type ProductPriceHistory = z.infer<typeof ProductPriceHistory>;
export const ProductPriceHistory = z.object({
  date: z.string().optional(),
  price: z.number().optional(),
  shopping_location: ShoppingLocation.optional(),
});

export type ExternalBarcodeLookupResponse = z.infer<typeof ExternalBarcodeLookupResponse>;
export const ExternalBarcodeLookupResponse = z.object({
  name: z.string().optional(),
  location_id: z.number().optional(),
  qu_id_purchase: z.number().optional(),
  qu_id_stock: z.number().optional(),
  qu_factor_purchase_to_stock: z.number().optional(),
  barcode: z.string().optional(),
  id: z.number().optional(),
});

export type Chore = z.infer<typeof Chore>;
export const Chore = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  period_type: z
    .union([z.literal("manually"), z.literal("hourly"), z.literal("daily"), z.literal("weekly"), z.literal("monthly")])
    .optional(),
  period_config: z.string().optional(),
  period_days: z.number().optional(),
  track_date_only: z.boolean().optional(),
  rollover: z.boolean().optional(),
  assignment_type: z
    .union([
      z.literal("no-assignment"),
      z.literal("who-least-did-first"),
      z.literal("random"),
      z.literal("in-alphabetical-order"),
    ])
    .optional(),
  assignment_config: z.string().optional(),
  next_execution_assigned_to_user_id: z.number().optional(),
  start_date: z.string().optional(),
  rescheduled_date: z.string().optional(),
  rescheduled_next_execution_assigned_to_user_id: z.number().optional(),
  row_created_timestamp: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type UserDto = z.infer<typeof UserDto>;
export const UserDto = z.object({
  id: z.number().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  display_name: z.string().optional(),
  picture_file_name: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type ChoreDetailsResponse = z.infer<typeof ChoreDetailsResponse>;
export const ChoreDetailsResponse = z.object({
  chore: Chore.optional(),
  last_tracked: z.string().optional(),
  track_count: z.number().optional(),
  last_done_by: UserDto.optional(),
  next_estimated_execution_time: z.string().optional(),
  next_execution_assigned_user: UserDto.optional(),
  average_execution_frequency_hours: z.number().optional(),
});

export type Battery = z.infer<typeof Battery>;
export const Battery = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  used_in: z.string().optional(),
  charge_interval_days: z.number().optional(),
  row_created_timestamp: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type BatteryDetailsResponse = z.infer<typeof BatteryDetailsResponse>;
export const BatteryDetailsResponse = z.object({
  chore: Battery.optional(),
  last_charged: z.string().optional(),
  charge_cycles_count: z.number().optional(),
  next_estimated_charge_time: z.string().optional(),
});

export type Session = z.infer<typeof Session>;
export const Session = z.object({
  id: z.number().optional(),
  session_key: z.string().optional(),
  expires: z.string().optional(),
  last_used: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type User = z.infer<typeof User>;
export const User = z.object({
  id: z.number().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  password: z.string().optional(),
  picture_file_name: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type ApiKey = z.infer<typeof ApiKey>;
export const ApiKey = z.object({
  id: z.number().optional(),
  api_key: z.string().optional(),
  expires: z.string().optional(),
  last_used: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type ShoppingListItem = z.infer<typeof ShoppingListItem>;
export const ShoppingListItem = z.object({
  id: z.number().optional(),
  shopping_list_id: z.number().optional(),
  product_id: z.number().optional(),
  note: z.string().optional(),
  amount: z.number().optional(),
  row_created_timestamp: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type BatteryChargeCycleEntry = z.infer<typeof BatteryChargeCycleEntry>;
export const BatteryChargeCycleEntry = z.object({
  id: z.number().optional(),
  battery_id: z.number().optional(),
  tracked_time: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type ChoreLogEntry = z.infer<typeof ChoreLogEntry>;
export const ChoreLogEntry = z.object({
  id: z.number().optional(),
  chore_id: z.number().optional(),
  tracked_time: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type StockTransactionType = z.infer<typeof StockTransactionType>;
export const StockTransactionType = z.union([
  z.literal("purchase"),
  z.literal("consume"),
  z.literal("inventory-correction"),
  z.literal("product-opened"),
]);

export type StockLogEntry = z.infer<typeof StockLogEntry>;
export const StockLogEntry = z.object({
  id: z.number().optional(),
  product_id: z.number().optional(),
  amount: z.number().optional(),
  best_before_date: z.string().optional(),
  purchased_date: z.string().optional(),
  used_date: z.string().optional(),
  spoiled: z.boolean().optional(),
  stock_id: z.string().optional(),
  transaction_id: z.string().optional(),
  transaction_type: StockTransactionType.optional(),
  note: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type StockJournal = z.infer<typeof StockJournal>;
export const StockJournal = z.object({
  correlation_id: z.string().optional(),
  undone: z.number().optional(),
  undone_timestamp: z.string().optional(),
  amount: z.number().optional(),
  location_id: z.number().optional(),
  location_name: z.string().optional(),
  product_name: z.string().optional(),
  qu_name: z.string().optional(),
  qu_name_plural: z.string().optional(),
  user_display_name: z.string().optional(),
  spoiled: z.boolean().optional(),
  transaction_type: StockTransactionType.optional(),
  row_created_timestamp: z.string().optional(),
});

export type StockJournalSummary = z.infer<typeof StockJournalSummary>;
export const StockJournalSummary = z.object({
  amount: z.number().optional(),
  user_id: z.number().optional(),
  product_name: z.string().optional(),
  product_id: z.number().optional(),
  qu_name: z.string().optional(),
  qu_name_plural: z.string().optional(),
  user_display_name: z.string().optional(),
  transaction_type: StockTransactionType.optional(),
});

export type Error400 = z.infer<typeof Error400>;
export const Error400 = z.object({
  error_message: z.string().optional(),
});

export type Error500 = z.infer<typeof Error500>;
export const Error500 = z.object({
  error_message: z.string().optional(),
  error_details: z
    .object({
      stack_trace: z.string().optional(),
      file: z.string().optional(),
      line: z.number().optional(),
    })
    .optional(),
});

export type CurrentStockResponse = z.infer<typeof CurrentStockResponse>;
export const CurrentStockResponse = z.object({
  product_id: z.number().optional(),
  amount: z.number().optional(),
  amount_aggregated: z.number().optional(),
  amount_opened: z.number().optional(),
  amount_opened_aggregated: z.number().optional(),
  best_before_date: z.string().optional(),
  is_aggregated_amount: z.boolean().optional(),
  product: ProductWithoutUserfields.optional(),
});

export type CurrentChoreResponse = z.infer<typeof CurrentChoreResponse>;
export const CurrentChoreResponse = z.object({
  chore_id: z.number().optional(),
  chore_name: z.string().optional(),
  last_tracked_time: z.string().optional(),
  track_date_only: z.boolean().optional(),
  next_estimated_execution_time: z.string().optional(),
  next_execution_assigned_to_user_id: z.number().optional(),
  is_rescheduled: z.boolean().optional(),
  is_reassigned: z.boolean().optional(),
  next_execution_assigned_user: UserDto.optional(),
});

export type CurrentBatteryResponse = z.infer<typeof CurrentBatteryResponse>;
export const CurrentBatteryResponse = z.object({
  battery_id: z.number().optional(),
  last_tracked_time: z.string().optional(),
  next_estimated_charge_time: z.string().optional(),
});

export type CurrentVolatilStockResponse = z.infer<typeof CurrentVolatilStockResponse>;
export const CurrentVolatilStockResponse = z.object({
  due_products: z.array(CurrentStockResponse).optional(),
  overdue_products: z.array(CurrentStockResponse).optional(),
  expired_products: z.array(CurrentStockResponse).optional(),
  missing_products: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
        amount_missing: z.number().optional(),
        is_partly_in_stock: z.number().optional(),
      }),
    )
    .optional(),
});

export type Task = z.infer<typeof Task>;
export const Task = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  done: z.number().optional(),
  done_timestamp: z.string().optional(),
  category_id: z.number().optional(),
  assigned_to_user_id: z.number().optional(),
  row_created_timestamp: z.string().optional(),
  userfields: z.unknown().optional(),
});

export type TaskCategory = z.infer<typeof TaskCategory>;
export const TaskCategory = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  row_created_timestamp: z.string().optional(),
});

export type CurrentTaskResponse = z.infer<typeof CurrentTaskResponse>;
export const CurrentTaskResponse = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  done: z.number().optional(),
  done_timestamp: z.string().optional(),
  category_id: z.number().optional(),
  assigned_to_user_id: z.number().optional(),
  row_created_timestamp: z.string().optional(),
  assigned_to_user: UserDto.optional(),
  category: TaskCategory.optional(),
});

export type DbChangedTimeResponse = z.infer<typeof DbChangedTimeResponse>;
export const DbChangedTimeResponse = z.object({
  changed_time: z.string().optional(),
});

export type TimeResponse = z.infer<typeof TimeResponse>;
export const TimeResponse = z.object({
  timezone: z.string().optional(),
  time_local: z.string().optional(),
  time_local_sqlite3: z.string().optional(),
  time_utc: z.string().optional(),
  timestamp: z.number().optional(),
  offset: z.number().optional(),
});

export type UserSetting = z.infer<typeof UserSetting>;
export const UserSetting = z.object({
  value: z.string().optional(),
});

export type MissingLocalizationRequest = z.infer<typeof MissingLocalizationRequest>;
export const MissingLocalizationRequest = z.object({
  text: z.string().optional(),
});

export type ExposedEntity = z.infer<typeof ExposedEntity>;
export const ExposedEntity = z.union([
  z.literal("products"),
  z.literal("chores"),
  z.literal("product_barcodes"),
  z.literal("batteries"),
  z.literal("locations"),
  z.literal("quantity_units"),
  z.literal("quantity_unit_conversions"),
  z.literal("shopping_list"),
  z.literal("shopping_lists"),
  z.literal("shopping_locations"),
  z.literal("recipes"),
  z.literal("recipes_pos"),
  z.literal("recipes_nestings"),
  z.literal("tasks"),
  z.literal("task_categories"),
  z.literal("product_groups"),
  z.literal("equipment"),
  z.literal("api_keys"),
  z.literal("userfields"),
  z.literal("userentities"),
  z.literal("userobjects"),
  z.literal("meal_plan"),
  z.literal("stock_log"),
  z.literal("stock"),
  z.literal("stock_current_locations"),
  z.literal("chores_log"),
  z.literal("meal_plan_sections"),
  z.literal("products_last_purchased"),
  z.literal("products_average_price"),
  z.literal("quantity_unit_conversions_resolved"),
  z.literal("recipes_pos_resolved"),
  z.literal("battery_charge_cycles"),
  z.literal("product_barcodes_view"),
]);

export type ExposedEntityNoListing = z.infer<typeof ExposedEntityNoListing>;
export const ExposedEntityNoListing = z.literal("api_keys");

export type ExposedEntityNoEdit = z.infer<typeof ExposedEntityNoEdit>;
export const ExposedEntityNoEdit = z.union([
  z.literal("stock_log"),
  z.literal("api_keys"),
  z.literal("stock"),
  z.literal("stock_current_locations"),
  z.literal("chores_log"),
  z.literal("products_last_purchased"),
  z.literal("products_average_price"),
  z.literal("quantity_unit_conversions_resolved"),
  z.literal("recipes_pos_resolved"),
  z.literal("battery_charge_cycles"),
  z.literal("product_barcodes_view"),
]);

export type ExposedEntityNoDelete = z.infer<typeof ExposedEntityNoDelete>;
export const ExposedEntityNoDelete = z.union([
  z.literal("stock_log"),
  z.literal("stock"),
  z.literal("stock_current_locations"),
  z.literal("chores_log"),
  z.literal("products_last_purchased"),
  z.literal("products_average_price"),
  z.literal("quantity_unit_conversions_resolved"),
  z.literal("recipes_pos_resolved"),
  z.literal("battery_charge_cycles"),
  z.literal("product_barcodes_view"),
]);

export type FileGroups = z.infer<typeof FileGroups>;
export const FileGroups = z.union([
  z.literal("equipmentmanuals"),
  z.literal("recipepictures"),
  z.literal("productpictures"),
  z.literal("userfiles"),
  z.literal("userpictures"),
]);

export type StringEnumTemplate = z.infer<typeof StringEnumTemplate>;
export const StringEnumTemplate = z.literal("");

export type ExposedEntity_IncludingUserEntities = z.infer<typeof ExposedEntity_IncludingUserEntities>;
export const ExposedEntity_IncludingUserEntities = z.union([
  z.literal(""),
  z.literal("api_keys"),
  z.literal("batteries"),
  z.literal("battery_charge_cycles"),
  z.literal("chores"),
  z.literal("chores_log"),
  z.literal("equipment"),
  z.literal("locations"),
  z.literal("meal_plan"),
  z.literal("meal_plan_sections"),
  z.literal("product_barcodes"),
  z.literal("product_barcodes_view"),
  z.literal("product_groups"),
  z.literal("products"),
  z.literal("products_average_price"),
  z.literal("products_last_purchased"),
  z.literal("quantity_unit_conversions"),
  z.literal("quantity_unit_conversions_resolved"),
  z.literal("quantity_units"),
  z.literal("recipes"),
  z.literal("recipes_nestings"),
  z.literal("recipes_pos"),
  z.literal("recipes_pos_resolved"),
  z.literal("shopping_list"),
  z.literal("shopping_lists"),
  z.literal("shopping_locations"),
  z.literal("stock"),
  z.literal("stock_current_locations"),
  z.literal("stock_log"),
  z.literal("task_categories"),
  z.literal("tasks"),
  z.literal("userentities"),
  z.literal("userfields"),
  z.literal("userobjects"),
  z.literal("users"),
]);

export type ExposedEntity_NotIncludingNotEditable = z.infer<typeof ExposedEntity_NotIncludingNotEditable>;
export const ExposedEntity_NotIncludingNotEditable = z.union([
  z.literal(""),
  z.literal("batteries"),
  z.literal("chores"),
  z.literal("equipment"),
  z.literal("locations"),
  z.literal("meal_plan"),
  z.literal("meal_plan_sections"),
  z.literal("product_barcodes"),
  z.literal("product_groups"),
  z.literal("products"),
  z.literal("quantity_unit_conversions"),
  z.literal("quantity_units"),
  z.literal("recipes"),
  z.literal("recipes_nestings"),
  z.literal("recipes_pos"),
  z.literal("shopping_list"),
  z.literal("shopping_lists"),
  z.literal("shopping_locations"),
  z.literal("task_categories"),
  z.literal("tasks"),
  z.literal("userentities"),
  z.literal("userfields"),
  z.literal("userobjects"),
]);

export type ExposedEntity_IncludingUserEntities_NotIncludingNotEditable = z.infer<
  typeof ExposedEntity_IncludingUserEntities_NotIncludingNotEditable
>;
export const ExposedEntity_IncludingUserEntities_NotIncludingNotEditable = z.union([
  z.literal(""),
  z.literal(""),
  z.literal("batteries"),
  z.literal("chores"),
  z.literal("equipment"),
  z.literal("locations"),
  z.literal("meal_plan"),
  z.literal("meal_plan_sections"),
  z.literal("product_barcodes"),
  z.literal("product_groups"),
  z.literal("products"),
  z.literal("quantity_unit_conversions"),
  z.literal("quantity_units"),
  z.literal("recipes"),
  z.literal("recipes_nestings"),
  z.literal("recipes_pos"),
  z.literal("shopping_list"),
  z.literal("shopping_lists"),
  z.literal("shopping_locations"),
  z.literal("stock"),
  z.literal("task_categories"),
  z.literal("tasks"),
  z.literal("userentities"),
  z.literal("userfields"),
  z.literal("userobjects"),
  z.literal("users"),
]);

export type ExposedEntity_NotIncludingNotDeletable = z.infer<typeof ExposedEntity_NotIncludingNotDeletable>;
export const ExposedEntity_NotIncludingNotDeletable = z.union([
  z.literal(""),
  z.literal("api_keys"),
  z.literal("batteries"),
  z.literal("chores"),
  z.literal("equipment"),
  z.literal("locations"),
  z.literal("meal_plan"),
  z.literal("meal_plan_sections"),
  z.literal("product_barcodes"),
  z.literal("product_groups"),
  z.literal("products"),
  z.literal("quantity_unit_conversions"),
  z.literal("quantity_units"),
  z.literal("recipes"),
  z.literal("recipes_nestings"),
  z.literal("recipes_pos"),
  z.literal("shopping_list"),
  z.literal("shopping_lists"),
  z.literal("shopping_locations"),
  z.literal("task_categories"),
  z.literal("tasks"),
  z.literal("userentities"),
  z.literal("userfields"),
  z.literal("userobjects"),
]);

export type ExposedEntity_NotIncludingNotListable = z.infer<typeof ExposedEntity_NotIncludingNotListable>;
export const ExposedEntity_NotIncludingNotListable = z.union([
  z.literal(""),
  z.literal("batteries"),
  z.literal("battery_charge_cycles"),
  z.literal("chores"),
  z.literal("chores_log"),
  z.literal("equipment"),
  z.literal("locations"),
  z.literal("meal_plan"),
  z.literal("meal_plan_sections"),
  z.literal("product_barcodes"),
  z.literal("product_barcodes_view"),
  z.literal("product_groups"),
  z.literal("products"),
  z.literal("products_average_price"),
  z.literal("products_last_purchased"),
  z.literal("quantity_unit_conversions"),
  z.literal("quantity_unit_conversions_resolved"),
  z.literal("quantity_units"),
  z.literal("recipes"),
  z.literal("recipes_nestings"),
  z.literal("recipes_pos"),
  z.literal("recipes_pos_resolved"),
  z.literal("shopping_list"),
  z.literal("shopping_lists"),
  z.literal("shopping_locations"),
  z.literal("stock"),
  z.literal("stock_current_locations"),
  z.literal("stock_log"),
  z.literal("task_categories"),
  z.literal("tasks"),
  z.literal("userentities"),
  z.literal("userfields"),
  z.literal("userobjects"),
]);

export type get_Systeminfo = typeof get_Systeminfo;
export const get_Systeminfo = {
  method: z.literal("GET"),
  path: z.literal("/system/info"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.object({
    grocy_version: z
      .object({
        Version: z.string().optional(),
        ReleaseDate: z.string().optional(),
      })
      .optional(),
    php_version: z.string().optional(),
    sqlite_version: z.string().optional(),
  }),
};

export type get_SystemdbChangedTime = typeof get_SystemdbChangedTime;
export const get_SystemdbChangedTime = {
  method: z.literal("GET"),
  path: z.literal("/system/db-changed-time"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: DbChangedTimeResponse,
};

export type get_Systemconfig = typeof get_Systemconfig;
export const get_Systemconfig = {
  method: z.literal("GET"),
  path: z.literal("/system/config"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_Systemtime = typeof get_Systemtime;
export const get_Systemtime = {
  method: z.literal("GET"),
  path: z.literal("/system/time"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      offset: z.number().optional(),
    }),
  }),
  response: TimeResponse,
};

export type get_SystemlocalizationStrings = typeof get_SystemlocalizationStrings;
export const get_SystemlocalizationStrings = {
  method: z.literal("GET"),
  path: z.literal("/system/localization-strings"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type post_SystemlogMissingLocalization = typeof post_SystemlogMissingLocalization;
export const post_SystemlogMissingLocalization = {
  method: z.literal("POST"),
  path: z.literal("/system/log-missing-localization"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: MissingLocalizationRequest,
  }),
  response: z.unknown(),
};

export type get_ObjectsEntity = typeof get_ObjectsEntity;
export const get_ObjectsEntity = {
  method: z.literal("GET"),
  path: z.literal("/objects/{entity}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal("batteries"),
        z.literal("battery_charge_cycles"),
        z.literal("chores"),
        z.literal("chores_log"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_barcodes_view"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("products_average_price"),
        z.literal("products_last_purchased"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_unit_conversions_resolved"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("recipes_pos_resolved"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("stock"),
        z.literal("stock_current_locations"),
        z.literal("stock_log"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
      ]),
    }),
  }),
  response: z.array(
    z.union([Product, Chore, Battery, Location, QuantityUnit, ShoppingListItem, StockEntry, ProductBarcode]),
  ),
};

export type post_ObjectsEntity = typeof post_ObjectsEntity;
export const post_ObjectsEntity = {
  method: z.literal("POST"),
  path: z.literal("/objects/{entity}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal("batteries"),
        z.literal("chores"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
      ]),
    }),
    body: z.union([Product, Chore, Battery, Location, QuantityUnit, ShoppingListItem, StockEntry, ProductBarcode]),
  }),
  response: z.object({
    created_object_id: z.number().optional(),
  }),
};

export type get_ObjectsEntityObjectId = typeof get_ObjectsEntityObjectId;
export const get_ObjectsEntityObjectId = {
  method: z.literal("GET"),
  path: z.literal("/objects/{entity}/{objectId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal("batteries"),
        z.literal("battery_charge_cycles"),
        z.literal("chores"),
        z.literal("chores_log"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_barcodes_view"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("products_average_price"),
        z.literal("products_last_purchased"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_unit_conversions_resolved"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("recipes_pos_resolved"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("stock"),
        z.literal("stock_current_locations"),
        z.literal("stock_log"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
      ]),
      objectId: z.number(),
    }),
  }),
  response: z.union([Product, Chore, Battery, Location, QuantityUnit, ShoppingListItem, StockEntry, ProductBarcode]),
};

export type put_ObjectsEntityObjectId = typeof put_ObjectsEntityObjectId;
export const put_ObjectsEntityObjectId = {
  method: z.literal("PUT"),
  path: z.literal("/objects/{entity}/{objectId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal("batteries"),
        z.literal("chores"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
      ]),
      objectId: z.number(),
    }),
    body: z.union([Product, Chore, Battery, Location, QuantityUnit, ShoppingListItem, StockEntry, ProductBarcode]),
  }),
  response: z.unknown(),
};

export type delete_ObjectsEntityObjectId = typeof delete_ObjectsEntityObjectId;
export const delete_ObjectsEntityObjectId = {
  method: z.literal("DELETE"),
  path: z.literal("/objects/{entity}/{objectId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal("api_keys"),
        z.literal("batteries"),
        z.literal("chores"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
      ]),
      objectId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_UserfieldsEntityObjectId = typeof get_UserfieldsEntityObjectId;
export const get_UserfieldsEntityObjectId = {
  method: z.literal("GET"),
  path: z.literal("/userfields/{entity}/{objectId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal("api_keys"),
        z.literal("batteries"),
        z.literal("battery_charge_cycles"),
        z.literal("chores"),
        z.literal("chores_log"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_barcodes_view"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("products_average_price"),
        z.literal("products_last_purchased"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_unit_conversions_resolved"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("recipes_pos_resolved"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("stock"),
        z.literal("stock_current_locations"),
        z.literal("stock_log"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
        z.literal("users"),
      ]),
      objectId: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type put_UserfieldsEntityObjectId = typeof put_UserfieldsEntityObjectId;
export const put_UserfieldsEntityObjectId = {
  method: z.literal("PUT"),
  path: z.literal("/userfields/{entity}/{objectId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entity: z.union([
        z.literal(""),
        z.literal(""),
        z.literal("batteries"),
        z.literal("chores"),
        z.literal("equipment"),
        z.literal("locations"),
        z.literal("meal_plan"),
        z.literal("meal_plan_sections"),
        z.literal("product_barcodes"),
        z.literal("product_groups"),
        z.literal("products"),
        z.literal("quantity_unit_conversions"),
        z.literal("quantity_units"),
        z.literal("recipes"),
        z.literal("recipes_nestings"),
        z.literal("recipes_pos"),
        z.literal("shopping_list"),
        z.literal("shopping_lists"),
        z.literal("shopping_locations"),
        z.literal("stock"),
        z.literal("task_categories"),
        z.literal("tasks"),
        z.literal("userentities"),
        z.literal("userfields"),
        z.literal("userobjects"),
        z.literal("users"),
      ]),
      objectId: z.string(),
    }),
    body: z.unknown(),
  }),
  response: z.unknown(),
};

export type get_FilesGroupFileName = typeof get_FilesGroupFileName;
export const get_FilesGroupFileName = {
  method: z.literal("GET"),
  path: z.literal("/files/{group}/{fileName}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      force_serve_as: z.literal("picture").optional(),
      best_fit_height: z.number().optional(),
      best_fit_width: z.number().optional(),
    }),
    path: z.object({
      group: z.union([
        z.literal("equipmentmanuals"),
        z.literal("recipepictures"),
        z.literal("productpictures"),
        z.literal("userfiles"),
        z.literal("userpictures"),
      ]),
      fileName: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type put_FilesGroupFileName = typeof put_FilesGroupFileName;
export const put_FilesGroupFileName = {
  method: z.literal("PUT"),
  path: z.literal("/files/{group}/{fileName}"),
  requestFormat: z.literal("binary"),
  parameters: z.object({
    path: z.object({
      group: z.union([
        z.literal("equipmentmanuals"),
        z.literal("recipepictures"),
        z.literal("productpictures"),
        z.literal("userfiles"),
        z.literal("userpictures"),
      ]),
      fileName: z.string(),
    }),
    body: z.string(),
  }),
  response: z.unknown(),
};

export type delete_FilesGroupFileName = typeof delete_FilesGroupFileName;
export const delete_FilesGroupFileName = {
  method: z.literal("DELETE"),
  path: z.literal("/files/{group}/{fileName}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      group: z.union([
        z.literal("equipmentmanuals"),
        z.literal("recipepictures"),
        z.literal("productpictures"),
        z.literal("userfiles"),
        z.literal("userpictures"),
      ]),
      fileName: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type get_Users = typeof get_Users;
export const get_Users = {
  method: z.literal("GET"),
  path: z.literal("/users"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  }),
  response: z.array(UserDto),
};

export type post_Users = typeof post_Users;
export const post_Users = {
  method: z.literal("POST"),
  path: z.literal("/users"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: User,
  }),
  response: z.unknown(),
};

export type put_UsersUserId = typeof put_UsersUserId;
export const put_UsersUserId = {
  method: z.literal("PUT"),
  path: z.literal("/users/{userId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      userId: z.number(),
    }),
    body: User,
  }),
  response: z.unknown(),
};

export type delete_UsersUserId = typeof delete_UsersUserId;
export const delete_UsersUserId = {
  method: z.literal("DELETE"),
  path: z.literal("/users/{userId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      userId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_UsersUserIdpermissions = typeof get_UsersUserIdpermissions;
export const get_UsersUserIdpermissions = {
  method: z.literal("GET"),
  path: z.literal("/users/{userId}/permissions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      userId: z.number(),
    }),
  }),
  response: z.array(
    z.object({
      permission_id: z.number().optional(),
      user_id: z.number().optional(),
    }),
  ),
};

export type post_UsersUserIdpermissions = typeof post_UsersUserIdpermissions;
export const post_UsersUserIdpermissions = {
  method: z.literal("POST"),
  path: z.literal("/users/{userId}/permissions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      userId: z.number(),
    }),
    body: z.object({
      permissions_id: z.number().optional(),
    }),
  }),
  response: z.unknown(),
};

export type put_UsersUserIdpermissions = typeof put_UsersUserIdpermissions;
export const put_UsersUserIdpermissions = {
  method: z.literal("PUT"),
  path: z.literal("/users/{userId}/permissions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      userId: z.number(),
    }),
    body: z.object({
      permissions: z.array(z.number()).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_User = typeof get_User;
export const get_User = {
  method: z.literal("GET"),
  path: z.literal("/user"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_Usersettings = typeof get_Usersettings;
export const get_Usersettings = {
  method: z.literal("GET"),
  path: z.literal("/user/settings"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_UsersettingsSettingKey = typeof get_UsersettingsSettingKey;
export const get_UsersettingsSettingKey = {
  method: z.literal("GET"),
  path: z.literal("/user/settings/{settingKey}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      settingKey: z.string(),
    }),
  }),
  response: UserSetting,
};

export type put_UsersettingsSettingKey = typeof put_UsersettingsSettingKey;
export const put_UsersettingsSettingKey = {
  method: z.literal("PUT"),
  path: z.literal("/user/settings/{settingKey}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      settingKey: z.string(),
    }),
    body: UserSetting,
  }),
  response: z.unknown(),
};

export type delete_UsersettingsSettingKey = typeof delete_UsersettingsSettingKey;
export const delete_UsersettingsSettingKey = {
  method: z.literal("DELETE"),
  path: z.literal("/user/settings/{settingKey}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      settingKey: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type get_Stock = typeof get_Stock;
export const get_Stock = {
  method: z.literal("GET"),
  path: z.literal("/stock"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.array(CurrentStockResponse),
};

export type get_StockentryEntryId = typeof get_StockentryEntryId;
export const get_StockentryEntryId = {
  method: z.literal("GET"),
  path: z.literal("/stock/entry/{entryId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entryId: z.number(),
    }),
  }),
  response: StockEntry,
};

export type put_StockentryEntryId = typeof put_StockentryEntryId;
export const put_StockentryEntryId = {
  method: z.literal("PUT"),
  path: z.literal("/stock/entry/{entryId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entryId: z.number(),
    }),
    body: z.object({
      amount: z.number().optional(),
      best_before_date: z.string().optional(),
      price: z.number().optional(),
      open: z.boolean().optional(),
      location_id: z.number().optional(),
      shopping_location_id: z.number().optional(),
      purchased_date: z.string().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type get_StockentryEntryIdprintlabel = typeof get_StockentryEntryIdprintlabel;
export const get_StockentryEntryIdprintlabel = {
  method: z.literal("GET"),
  path: z.literal("/stock/entry/{entryId}/printlabel"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      entryId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_Stockvolatile = typeof get_Stockvolatile;
export const get_Stockvolatile = {
  method: z.literal("GET"),
  path: z.literal("/stock/volatile"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      due_soon_days: z.number().optional(),
    }),
  }),
  response: z.array(CurrentVolatilStockResponse),
};

export type get_StockproductsProductId = typeof get_StockproductsProductId;
export const get_StockproductsProductId = {
  method: z.literal("GET"),
  path: z.literal("/stock/products/{productId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
  }),
  response: ProductDetailsResponse,
};

export type get_StockproductsProductIdlocations = typeof get_StockproductsProductIdlocations;
export const get_StockproductsProductIdlocations = {
  method: z.literal("GET"),
  path: z.literal("/stock/products/{productId}/locations"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      include_sub_products: z.boolean().optional(),
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    path: z.object({
      productId: z.number(),
    }),
  }),
  response: z.array(StockLocation),
};

export type get_StockproductsProductIdentries = typeof get_StockproductsProductIdentries;
export const get_StockproductsProductIdentries = {
  method: z.literal("GET"),
  path: z.literal("/stock/products/{productId}/entries"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      include_sub_products: z.boolean().optional(),
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    path: z.object({
      productId: z.number(),
    }),
  }),
  response: z.array(StockEntry),
};

export type get_StockproductsProductIdpriceHistory = typeof get_StockproductsProductIdpriceHistory;
export const get_StockproductsProductIdpriceHistory = {
  method: z.literal("GET"),
  path: z.literal("/stock/products/{productId}/price-history"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
  }),
  response: z.array(ProductPriceHistory),
};

export type post_StockproductsProductIdadd = typeof post_StockproductsProductIdadd;
export const post_StockproductsProductIdadd = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/{productId}/add"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
    body: z.object({
      amount: z.number().optional(),
      best_before_date: z.string().optional(),
      transaction_type: StockTransactionType.optional(),
      price: z.number().optional(),
      location_id: z.number().optional(),
      shopping_location_id: z.number().optional(),
      stock_label_type: z.number().optional(),
      note: z.string().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsProductIdconsume = typeof post_StockproductsProductIdconsume;
export const post_StockproductsProductIdconsume = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/{productId}/consume"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
    body: z.object({
      amount: z.number().optional(),
      transaction_type: StockTransactionType.optional(),
      spoiled: z.boolean().optional(),
      stock_entry_id: z.string().optional(),
      recipe_id: z.number().optional(),
      location_id: z.number().optional(),
      exact_amount: z.boolean().optional(),
      allow_subproduct_substitution: z.boolean().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsProductIdtransfer = typeof post_StockproductsProductIdtransfer;
export const post_StockproductsProductIdtransfer = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/{productId}/transfer"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
    body: z.object({
      amount: z.number().optional(),
      location_id_from: z.number().optional(),
      location_id_to: z.number().optional(),
      stock_entry_id: z.string().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsProductIdinventory = typeof post_StockproductsProductIdinventory;
export const post_StockproductsProductIdinventory = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/{productId}/inventory"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
    body: z.object({
      new_amount: z.number().optional(),
      best_before_date: z.string().optional(),
      shopping_location_id: z.number().optional(),
      location_id: z.number().optional(),
      price: z.number().optional(),
      stock_label_type: z.number().optional(),
      note: z.string().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsProductIdopen = typeof post_StockproductsProductIdopen;
export const post_StockproductsProductIdopen = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/{productId}/open"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
    body: z.object({
      amount: z.number().optional(),
      stock_entry_id: z.string().optional(),
      allow_subproduct_substitution: z.boolean().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type get_StockproductsProductIdprintlabel = typeof get_StockproductsProductIdprintlabel;
export const get_StockproductsProductIdprintlabel = {
  method: z.literal("GET"),
  path: z.literal("/stock/products/{productId}/printlabel"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type post_StockproductsProductIdToKeepmergeProductIdToRemove =
  typeof post_StockproductsProductIdToKeepmergeProductIdToRemove;
export const post_StockproductsProductIdToKeepmergeProductIdToRemove = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/{productIdToKeep}/merge/{productIdToRemove}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      productIdToKeep: z.number(),
      productIdToRemove: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_StockproductsbyBarcodeBarcode = typeof get_StockproductsbyBarcodeBarcode;
export const get_StockproductsbyBarcodeBarcode = {
  method: z.literal("GET"),
  path: z.literal("/stock/products/by-barcode/{barcode}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      barcode: z.string(),
    }),
  }),
  response: ProductDetailsResponse,
};

export type post_StockproductsbyBarcodeBarcodeadd = typeof post_StockproductsbyBarcodeBarcodeadd;
export const post_StockproductsbyBarcodeBarcodeadd = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/by-barcode/{barcode}/add"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      barcode: z.string(),
    }),
    body: z.object({
      amount: z.number().optional(),
      best_before_date: z.string().optional(),
      transaction_type: StockTransactionType.optional(),
      price: z.number().optional(),
      location_id: z.number().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsbyBarcodeBarcodeconsume = typeof post_StockproductsbyBarcodeBarcodeconsume;
export const post_StockproductsbyBarcodeBarcodeconsume = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/by-barcode/{barcode}/consume"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      barcode: z.string(),
    }),
    body: z.object({
      amount: z.number().optional(),
      transaction_type: StockTransactionType.optional(),
      spoiled: z.boolean().optional(),
      stock_entry_id: z.string().optional(),
      recipe_id: z.number().optional(),
      location_id: z.number().optional(),
      exact_amount: z.boolean().optional(),
      allow_subproduct_substitution: z.boolean().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsbyBarcodeBarcodetransfer = typeof post_StockproductsbyBarcodeBarcodetransfer;
export const post_StockproductsbyBarcodeBarcodetransfer = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/by-barcode/{barcode}/transfer"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      barcode: z.string(),
    }),
    body: z.object({
      amount: z.number().optional(),
      location_id_from: z.number().optional(),
      location_id_to: z.number().optional(),
      stock_entry_id: z.string().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsbyBarcodeBarcodeinventory = typeof post_StockproductsbyBarcodeBarcodeinventory;
export const post_StockproductsbyBarcodeBarcodeinventory = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/by-barcode/{barcode}/inventory"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      barcode: z.string(),
    }),
    body: z.object({
      new_amount: z.number().optional(),
      best_before_date: z.string().optional(),
      location_id: z.number().optional(),
      price: z.number().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StockproductsbyBarcodeBarcodeopen = typeof post_StockproductsbyBarcodeBarcodeopen;
export const post_StockproductsbyBarcodeBarcodeopen = {
  method: z.literal("POST"),
  path: z.literal("/stock/products/by-barcode/{barcode}/open"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      barcode: z.string(),
    }),
    body: z.object({
      amount: z.number().optional(),
      stock_entry_id: z.string().optional(),
      allow_subproduct_substitution: z.boolean().optional(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type get_StocklocationsLocationIdentries = typeof get_StocklocationsLocationIdentries;
export const get_StocklocationsLocationIdentries = {
  method: z.literal("GET"),
  path: z.literal("/stock/locations/{locationId}/entries"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    path: z.object({
      locationId: z.number(),
    }),
  }),
  response: z.array(StockEntry),
};

export type post_StockshoppinglistaddMissingProducts = typeof post_StockshoppinglistaddMissingProducts;
export const post_StockshoppinglistaddMissingProducts = {
  method: z.literal("POST"),
  path: z.literal("/stock/shoppinglist/add-missing-products"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      list_id: z.number().optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_StockshoppinglistaddOverdueProducts = typeof post_StockshoppinglistaddOverdueProducts;
export const post_StockshoppinglistaddOverdueProducts = {
  method: z.literal("POST"),
  path: z.literal("/stock/shoppinglist/add-overdue-products"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      list_id: z.number().optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_StockshoppinglistaddExpiredProducts = typeof post_StockshoppinglistaddExpiredProducts;
export const post_StockshoppinglistaddExpiredProducts = {
  method: z.literal("POST"),
  path: z.literal("/stock/shoppinglist/add-expired-products"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      list_id: z.number().optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Stockshoppinglistclear = typeof post_Stockshoppinglistclear;
export const post_Stockshoppinglistclear = {
  method: z.literal("POST"),
  path: z.literal("/stock/shoppinglist/clear"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      list_id: z.number().optional(),
      done_only: z.boolean().optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_StockshoppinglistaddProduct = typeof post_StockshoppinglistaddProduct;
export const post_StockshoppinglistaddProduct = {
  method: z.literal("POST"),
  path: z.literal("/stock/shoppinglist/add-product"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      product_id: z.number().optional(),
      qu_id: z.number().optional(),
      list_id: z.number().optional(),
      product_amount: z.number().optional(),
      note: z.string().optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_StockshoppinglistremoveProduct = typeof post_StockshoppinglistremoveProduct;
export const post_StockshoppinglistremoveProduct = {
  method: z.literal("POST"),
  path: z.literal("/stock/shoppinglist/remove-product"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      product_id: z.number().optional(),
      list_id: z.number().optional(),
      product_amount: z.number().optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_StockbookingsBookingId = typeof get_StockbookingsBookingId;
export const get_StockbookingsBookingId = {
  method: z.literal("GET"),
  path: z.literal("/stock/bookings/{bookingId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      bookingId: z.number(),
    }),
  }),
  response: StockLogEntry,
};

export type post_StockbookingsBookingIdundo = typeof post_StockbookingsBookingIdundo;
export const post_StockbookingsBookingIdundo = {
  method: z.literal("POST"),
  path: z.literal("/stock/bookings/{bookingId}/undo"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      bookingId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_StocktransactionsTransactionId = typeof get_StocktransactionsTransactionId;
export const get_StocktransactionsTransactionId = {
  method: z.literal("GET"),
  path: z.literal("/stock/transactions/{transactionId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      transactionId: z.string(),
    }),
  }),
  response: z.array(StockLogEntry),
};

export type post_StocktransactionsTransactionIdundo = typeof post_StocktransactionsTransactionIdundo;
export const post_StocktransactionsTransactionIdundo = {
  method: z.literal("POST"),
  path: z.literal("/stock/transactions/{transactionId}/undo"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      transactionId: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type get_StockbarcodesexternalLookupBarcode = typeof get_StockbarcodesexternalLookupBarcode;
export const get_StockbarcodesexternalLookupBarcode = {
  method: z.literal("GET"),
  path: z.literal("/stock/barcodes/external-lookup/{barcode}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      add: z.boolean().optional(),
    }),
    path: z.object({
      barcode: z.string(),
    }),
  }),
  response: ExternalBarcodeLookupResponse,
};

export type post_RecipesRecipeIdaddNotFulfilledProductsToShoppinglist =
  typeof post_RecipesRecipeIdaddNotFulfilledProductsToShoppinglist;
export const post_RecipesRecipeIdaddNotFulfilledProductsToShoppinglist = {
  method: z.literal("POST"),
  path: z.literal("/recipes/{recipeId}/add-not-fulfilled-products-to-shoppinglist"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipeId: z.string(),
    }),
    body: z.object({
      excludedProductIds: z.array(z.number()).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_RecipesRecipeIdfulfillment = typeof get_RecipesRecipeIdfulfillment;
export const get_RecipesRecipeIdfulfillment = {
  method: z.literal("GET"),
  path: z.literal("/recipes/{recipeId}/fulfillment"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipeId: z.string(),
    }),
  }),
  response: RecipeFulfillmentResponse,
};

export type post_RecipesRecipeIdconsume = typeof post_RecipesRecipeIdconsume;
export const post_RecipesRecipeIdconsume = {
  method: z.literal("POST"),
  path: z.literal("/recipes/{recipeId}/consume"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipeId: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type get_Recipesfulfillment = typeof get_Recipesfulfillment;
export const get_Recipesfulfillment = {
  method: z.literal("GET"),
  path: z.literal("/recipes/fulfillment"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  }),
  response: z.array(RecipeFulfillmentResponse),
};

export type post_RecipesRecipeIdcopy = typeof post_RecipesRecipeIdcopy;
export const post_RecipesRecipeIdcopy = {
  method: z.literal("POST"),
  path: z.literal("/recipes/{recipeId}/copy"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipeId: z.number(),
    }),
  }),
  response: z.object({
    created_object_id: z.number().optional(),
  }),
};

export type get_RecipesRecipeIdprintlabel = typeof get_RecipesRecipeIdprintlabel;
export const get_RecipesRecipeIdprintlabel = {
  method: z.literal("GET"),
  path: z.literal("/recipes/{recipeId}/printlabel"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipeId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_Chores = typeof get_Chores;
export const get_Chores = {
  method: z.literal("GET"),
  path: z.literal("/chores"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  }),
  response: z.array(CurrentChoreResponse),
};

export type get_ChoresChoreId = typeof get_ChoresChoreId;
export const get_ChoresChoreId = {
  method: z.literal("GET"),
  path: z.literal("/chores/{choreId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      choreId: z.number(),
    }),
  }),
  response: ChoreDetailsResponse,
};

export type post_ChoresChoreIdexecute = typeof post_ChoresChoreIdexecute;
export const post_ChoresChoreIdexecute = {
  method: z.literal("POST"),
  path: z.literal("/chores/{choreId}/execute"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      choreId: z.number(),
    }),
    body: z.object({
      tracked_time: z.string().optional(),
      done_by: z.number().optional(),
      skipped: z.boolean().optional(),
    }),
  }),
  response: ChoreLogEntry,
};

export type post_ChoresexecutionsExecutionIdundo = typeof post_ChoresexecutionsExecutionIdundo;
export const post_ChoresexecutionsExecutionIdundo = {
  method: z.literal("POST"),
  path: z.literal("/chores/executions/{executionId}/undo"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      executionId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type post_ChoresexecutionscalculateNextAssignments = typeof post_ChoresexecutionscalculateNextAssignments;
export const post_ChoresexecutionscalculateNextAssignments = {
  method: z.literal("POST"),
  path: z.literal("/chores/executions/calculate-next-assignments"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: z.object({
      chore_id: z.number().optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_ChoresChoreIdprintlabel = typeof get_ChoresChoreIdprintlabel;
export const get_ChoresChoreIdprintlabel = {
  method: z.literal("GET"),
  path: z.literal("/chores/{choreId}/printlabel"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      choreId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type post_ChoresChoreIdToKeepmergeChoreIdToRemove = typeof post_ChoresChoreIdToKeepmergeChoreIdToRemove;
export const post_ChoresChoreIdToKeepmergeChoreIdToRemove = {
  method: z.literal("POST"),
  path: z.literal("/chores/{choreIdToKeep}/merge/{choreIdToRemove}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      choreIdToKeep: z.number(),
      choreIdToRemove: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_Batteries = typeof get_Batteries;
export const get_Batteries = {
  method: z.literal("GET"),
  path: z.literal("/batteries"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  }),
  response: z.array(CurrentBatteryResponse),
};

export type get_BatteriesBatteryId = typeof get_BatteriesBatteryId;
export const get_BatteriesBatteryId = {
  method: z.literal("GET"),
  path: z.literal("/batteries/{batteryId}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      batteryId: z.number(),
    }),
  }),
  response: BatteryDetailsResponse,
};

export type post_BatteriesBatteryIdcharge = typeof post_BatteriesBatteryIdcharge;
export const post_BatteriesBatteryIdcharge = {
  method: z.literal("POST"),
  path: z.literal("/batteries/{batteryId}/charge"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      batteryId: z.number(),
    }),
    body: z.object({
      tracked_time: z.string().optional(),
    }),
  }),
  response: BatteryChargeCycleEntry,
};

export type post_BatterieschargeCyclesChargeCycleIdundo = typeof post_BatterieschargeCyclesChargeCycleIdundo;
export const post_BatterieschargeCyclesChargeCycleIdundo = {
  method: z.literal("POST"),
  path: z.literal("/batteries/charge-cycles/{chargeCycleId}/undo"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      chargeCycleId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_BatteriesBatteryIdprintlabel = typeof get_BatteriesBatteryIdprintlabel;
export const get_BatteriesBatteryIdprintlabel = {
  method: z.literal("GET"),
  path: z.literal("/batteries/{batteryId}/printlabel"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      batteryId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_Tasks = typeof get_Tasks;
export const get_Tasks = {
  method: z.literal("GET"),
  path: z.literal("/tasks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      "query[]": z.array(z.string()).optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  }),
  response: z.array(CurrentTaskResponse),
};

export type post_TasksTaskIdcomplete = typeof post_TasksTaskIdcomplete;
export const post_TasksTaskIdcomplete = {
  method: z.literal("POST"),
  path: z.literal("/tasks/{taskId}/complete"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      taskId: z.number(),
    }),
    body: z.object({
      done_time: z.string().optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_TasksTaskIdundo = typeof post_TasksTaskIdundo;
export const post_TasksTaskIdundo = {
  method: z.literal("POST"),
  path: z.literal("/tasks/{taskId}/undo"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      taskId: z.number(),
    }),
  }),
  response: z.unknown(),
};

export type get_Calendarical = typeof get_Calendarical;
export const get_Calendarical = {
  method: z.literal("GET"),
  path: z.literal("/calendar/ical"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_CalendaricalsharingLink = typeof get_CalendaricalsharingLink;
export const get_CalendaricalsharingLink = {
  method: z.literal("GET"),
  path: z.literal("/calendar/ical/sharing-link"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.object({
    url: z.string().optional(),
  }),
};

export type get_Printshoppinglistthermal = typeof get_Printshoppinglistthermal;
export const get_Printshoppinglistthermal = {
  method: z.literal("GET"),
  path: z.literal("/print/shoppinglist/thermal"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      list: z.number().optional(),
      printHeader: z.boolean().optional(),
    }),
  }),
  response: z.object({
    result: z.string().optional(),
  }),
};

// <EndpointByMethod>
export const EndpointByMethod = {
  get: {
    "/system/info": get_Systeminfo,
    "/system/db-changed-time": get_SystemdbChangedTime,
    "/system/config": get_Systemconfig,
    "/system/time": get_Systemtime,
    "/system/localization-strings": get_SystemlocalizationStrings,
    "/objects/{entity}": get_ObjectsEntity,
    "/objects/{entity}/{objectId}": get_ObjectsEntityObjectId,
    "/userfields/{entity}/{objectId}": get_UserfieldsEntityObjectId,
    "/files/{group}/{fileName}": get_FilesGroupFileName,
    "/users": get_Users,
    "/users/{userId}/permissions": get_UsersUserIdpermissions,
    "/user": get_User,
    "/user/settings": get_Usersettings,
    "/user/settings/{settingKey}": get_UsersettingsSettingKey,
    "/stock": get_Stock,
    "/stock/entry/{entryId}": get_StockentryEntryId,
    "/stock/entry/{entryId}/printlabel": get_StockentryEntryIdprintlabel,
    "/stock/volatile": get_Stockvolatile,
    "/stock/products/{productId}": get_StockproductsProductId,
    "/stock/products/{productId}/locations": get_StockproductsProductIdlocations,
    "/stock/products/{productId}/entries": get_StockproductsProductIdentries,
    "/stock/products/{productId}/price-history": get_StockproductsProductIdpriceHistory,
    "/stock/products/{productId}/printlabel": get_StockproductsProductIdprintlabel,
    "/stock/products/by-barcode/{barcode}": get_StockproductsbyBarcodeBarcode,
    "/stock/locations/{locationId}/entries": get_StocklocationsLocationIdentries,
    "/stock/bookings/{bookingId}": get_StockbookingsBookingId,
    "/stock/transactions/{transactionId}": get_StocktransactionsTransactionId,
    "/stock/barcodes/external-lookup/{barcode}": get_StockbarcodesexternalLookupBarcode,
    "/recipes/{recipeId}/fulfillment": get_RecipesRecipeIdfulfillment,
    "/recipes/fulfillment": get_Recipesfulfillment,
    "/recipes/{recipeId}/printlabel": get_RecipesRecipeIdprintlabel,
    "/chores": get_Chores,
    "/chores/{choreId}": get_ChoresChoreId,
    "/chores/{choreId}/printlabel": get_ChoresChoreIdprintlabel,
    "/batteries": get_Batteries,
    "/batteries/{batteryId}": get_BatteriesBatteryId,
    "/batteries/{batteryId}/printlabel": get_BatteriesBatteryIdprintlabel,
    "/tasks": get_Tasks,
    "/calendar/ical": get_Calendarical,
    "/calendar/ical/sharing-link": get_CalendaricalsharingLink,
    "/print/shoppinglist/thermal": get_Printshoppinglistthermal,
  },
  post: {
    "/system/log-missing-localization": post_SystemlogMissingLocalization,
    "/objects/{entity}": post_ObjectsEntity,
    "/users": post_Users,
    "/users/{userId}/permissions": post_UsersUserIdpermissions,
    "/stock/products/{productId}/add": post_StockproductsProductIdadd,
    "/stock/products/{productId}/consume": post_StockproductsProductIdconsume,
    "/stock/products/{productId}/transfer": post_StockproductsProductIdtransfer,
    "/stock/products/{productId}/inventory": post_StockproductsProductIdinventory,
    "/stock/products/{productId}/open": post_StockproductsProductIdopen,
    "/stock/products/{productIdToKeep}/merge/{productIdToRemove}":
      post_StockproductsProductIdToKeepmergeProductIdToRemove,
    "/stock/products/by-barcode/{barcode}/add": post_StockproductsbyBarcodeBarcodeadd,
    "/stock/products/by-barcode/{barcode}/consume": post_StockproductsbyBarcodeBarcodeconsume,
    "/stock/products/by-barcode/{barcode}/transfer": post_StockproductsbyBarcodeBarcodetransfer,
    "/stock/products/by-barcode/{barcode}/inventory": post_StockproductsbyBarcodeBarcodeinventory,
    "/stock/products/by-barcode/{barcode}/open": post_StockproductsbyBarcodeBarcodeopen,
    "/stock/shoppinglist/add-missing-products": post_StockshoppinglistaddMissingProducts,
    "/stock/shoppinglist/add-overdue-products": post_StockshoppinglistaddOverdueProducts,
    "/stock/shoppinglist/add-expired-products": post_StockshoppinglistaddExpiredProducts,
    "/stock/shoppinglist/clear": post_Stockshoppinglistclear,
    "/stock/shoppinglist/add-product": post_StockshoppinglistaddProduct,
    "/stock/shoppinglist/remove-product": post_StockshoppinglistremoveProduct,
    "/stock/bookings/{bookingId}/undo": post_StockbookingsBookingIdundo,
    "/stock/transactions/{transactionId}/undo": post_StocktransactionsTransactionIdundo,
    "/recipes/{recipeId}/add-not-fulfilled-products-to-shoppinglist":
      post_RecipesRecipeIdaddNotFulfilledProductsToShoppinglist,
    "/recipes/{recipeId}/consume": post_RecipesRecipeIdconsume,
    "/recipes/{recipeId}/copy": post_RecipesRecipeIdcopy,
    "/chores/{choreId}/execute": post_ChoresChoreIdexecute,
    "/chores/executions/{executionId}/undo": post_ChoresexecutionsExecutionIdundo,
    "/chores/executions/calculate-next-assignments": post_ChoresexecutionscalculateNextAssignments,
    "/chores/{choreIdToKeep}/merge/{choreIdToRemove}": post_ChoresChoreIdToKeepmergeChoreIdToRemove,
    "/batteries/{batteryId}/charge": post_BatteriesBatteryIdcharge,
    "/batteries/charge-cycles/{chargeCycleId}/undo": post_BatterieschargeCyclesChargeCycleIdundo,
    "/tasks/{taskId}/complete": post_TasksTaskIdcomplete,
    "/tasks/{taskId}/undo": post_TasksTaskIdundo,
  },
  put: {
    "/objects/{entity}/{objectId}": put_ObjectsEntityObjectId,
    "/userfields/{entity}/{objectId}": put_UserfieldsEntityObjectId,
    "/files/{group}/{fileName}": put_FilesGroupFileName,
    "/users/{userId}": put_UsersUserId,
    "/users/{userId}/permissions": put_UsersUserIdpermissions,
    "/user/settings/{settingKey}": put_UsersettingsSettingKey,
    "/stock/entry/{entryId}": put_StockentryEntryId,
  },
  delete: {
    "/objects/{entity}/{objectId}": delete_ObjectsEntityObjectId,
    "/files/{group}/{fileName}": delete_FilesGroupFileName,
    "/users/{userId}": delete_UsersUserId,
    "/user/settings/{settingKey}": delete_UsersettingsSettingKey,
  },
};
export type EndpointByMethod = typeof EndpointByMethod;
// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type GetEndpoints = EndpointByMethod["get"];
export type PostEndpoints = EndpointByMethod["post"];
export type PutEndpoints = EndpointByMethod["put"];
export type DeleteEndpoints = EndpointByMethod["delete"];
export type AllEndpoints = EndpointByMethod[keyof EndpointByMethod];
// </EndpointByMethod.Shorthands>

// <ApiClientTypes>
export type EndpointParameters = {
  body?: unknown;
  query?: Record<string, unknown>;
  header?: Record<string, unknown>;
  path?: Record<string, unknown>;
};

export type MutationMethod = "post" | "put" | "patch" | "delete";
export type Method = "get" | "head" | "options" | MutationMethod;

type RequestFormat = "json" | "form-data" | "form-url" | "binary" | "text";

export type DefaultEndpoint = {
  parameters?: EndpointParameters | undefined;
  response: unknown;
};

export type Endpoint<TConfig extends DefaultEndpoint = DefaultEndpoint> = {
  operationId: string;
  method: Method;
  path: string;
  requestFormat: RequestFormat;
  parameters?: TConfig["parameters"];
  meta: {
    alias: string;
    hasParameters: boolean;
    areParametersRequired: boolean;
  };
  response: TConfig["response"];
};

type Fetcher = (
  method: Method,
  url: string,
  parameters?: EndpointParameters | undefined,
) => Promise<Endpoint["response"]>;

type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

type MaybeOptionalArg<T> = RequiredKeys<T> extends never ? [config?: T] : [config: T];

// </ApiClientTypes>

// <ApiClient>
export class ApiClient {
  baseUrl: string = "";

  constructor(public fetcher: Fetcher) {}

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    return this;
  }

  // <ApiClient.get>
  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint["parameters"]>>
  ): Promise<z.infer<TEndpoint["response"]>> {
    return this.fetcher("get", this.baseUrl + path, params[0]) as Promise<z.infer<TEndpoint["response"]>>;
  }
  // </ApiClient.get>

  // <ApiClient.post>
  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint["parameters"]>>
  ): Promise<z.infer<TEndpoint["response"]>> {
    return this.fetcher("post", this.baseUrl + path, params[0]) as Promise<z.infer<TEndpoint["response"]>>;
  }
  // </ApiClient.post>

  // <ApiClient.put>
  put<Path extends keyof PutEndpoints, TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint["parameters"]>>
  ): Promise<z.infer<TEndpoint["response"]>> {
    return this.fetcher("put", this.baseUrl + path, params[0]) as Promise<z.infer<TEndpoint["response"]>>;
  }
  // </ApiClient.put>

  // <ApiClient.delete>
  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint["parameters"]>>
  ): Promise<z.infer<TEndpoint["response"]>> {
    return this.fetcher("delete", this.baseUrl + path, params[0]) as Promise<z.infer<TEndpoint["response"]>>;
  }
  // </ApiClient.delete>
}

export function createApiClient(fetcher: Fetcher, baseUrl?: string) {
  return new ApiClient(fetcher).setBaseUrl(baseUrl ?? "");
}

/**
 Example usage:
 const api = createApiClient((method, url, params) =>
   fetch(url, { method, body: JSON.stringify(params) }).then((res) => res.json()),
 );
 api.get("/users").then((users) => console.log(users));
 api.post("/users", { body: { name: "John" } }).then((user) => console.log(user));
 api.put("/users/:id", { path: { id: 1 }, body: { name: "John" } }).then((user) => console.log(user));
*/

// </ApiClient
