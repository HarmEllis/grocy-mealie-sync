import { z } from "zod";

export type AdminAboutInfo = z.infer<typeof AdminAboutInfo>;
export const AdminAboutInfo = z.object({
  production: z.boolean(),
  version: z.string(),
  demoStatus: z.boolean(),
  allowSignup: z.boolean(),
  defaultGroupSlug: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  defaultHouseholdSlug: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()])
    .optional(),
  enableOidc: z.boolean(),
  oidcRedirect: z.boolean(),
  oidcProviderName: z.string(),
  enableOpenai: z.boolean(),
  enableOpenaiImageServices: z.boolean(),
  versionLatest: z.string(),
  apiPort: z.number(),
  apiDocs: z.boolean(),
  dbType: z.string(),
  dbUrl: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  defaultGroup: z.string(),
  defaultHousehold: z.string(),
  buildId: z.string(),
  recipeScraperVersion: z.string(),
});

export type BackupFile = z.infer<typeof BackupFile>;
export const BackupFile = z.object({
  name: z.string(),
  date: z.string(),
  size: z.string(),
});

export type AllBackups = z.infer<typeof AllBackups>;
export const AllBackups = z.object({
  imports: z.array(BackupFile),
  templates: z.array(z.string()),
});

export type AppInfo = z.infer<typeof AppInfo>;
export const AppInfo = z.object({
  production: z.boolean(),
  version: z.string(),
  demoStatus: z.boolean(),
  allowSignup: z.boolean(),
  defaultGroupSlug: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  defaultHouseholdSlug: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()])
    .optional(),
  enableOidc: z.boolean(),
  oidcRedirect: z.boolean(),
  oidcProviderName: z.string(),
  enableOpenai: z.boolean(),
  enableOpenaiImageServices: z.boolean(),
});

export type AppStartupInfo = z.infer<typeof AppStartupInfo>;
export const AppStartupInfo = z.object({
  isFirstLogin: z.boolean(),
  isDemo: z.boolean(),
});

export type AppStatistics = z.infer<typeof AppStatistics>;
export const AppStatistics = z.object({
  totalRecipes: z.number(),
  totalUsers: z.number(),
  totalHouseholds: z.number(),
  totalGroups: z.number(),
  uncategorizedRecipes: z.number(),
  untaggedRecipes: z.number(),
});

export type AppTheme = z.infer<typeof AppTheme>;
export const AppTheme = z.object({
  lightPrimary: z.string().optional(),
  lightAccent: z.string().optional(),
  lightSecondary: z.string().optional(),
  lightSuccess: z.string().optional(),
  lightInfo: z.string().optional(),
  lightWarning: z.string().optional(),
  lightError: z.string().optional(),
  darkPrimary: z.string().optional(),
  darkAccent: z.string().optional(),
  darkSecondary: z.string().optional(),
  darkSuccess: z.string().optional(),
  darkInfo: z.string().optional(),
  darkWarning: z.string().optional(),
  darkError: z.string().optional(),
});

export type CategoryBase = z.infer<typeof CategoryBase>;
export const CategoryBase = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
});

export type AssignCategories = z.infer<typeof AssignCategories>;
export const AssignCategories = z.object({
  recipes: z.array(z.string()),
  categories: z.array(CategoryBase),
});

export type RecipeSettings = z.infer<typeof RecipeSettings>;
export const RecipeSettings = z.object({
  public: z.boolean().optional(),
  showNutrition: z.boolean().optional(),
  showAssets: z.boolean().optional(),
  landscapeView: z.boolean().optional(),
  disableComments: z.boolean().optional(),
  disableAmount: z.boolean().optional(),
  locked: z.boolean().optional(),
});

export type AssignSettings = z.infer<typeof AssignSettings>;
export const AssignSettings = z.object({
  recipes: z.array(z.string()),
  settings: RecipeSettings,
});

export type TagBase = z.infer<typeof TagBase>;
export const TagBase = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
});

export type AssignTags = z.infer<typeof AssignTags>;
export const AssignTags = z.object({
  recipes: z.array(z.string()),
  tags: z.array(TagBase),
});

export type AuthMethod = z.infer<typeof AuthMethod>;
export const AuthMethod = z.union([z.literal("Mealie"), z.literal("LDAP"), z.literal("OIDC")]);

export type Body_create_recipe_from_image_api_recipes_create_image_post = z.infer<
  typeof Body_create_recipe_from_image_api_recipes_create_image_post
>;
export const Body_create_recipe_from_image_api_recipes_create_image_post = z.object({
  images: z.array(z.string()),
});

export type Body_create_recipe_from_zip_api_recipes_create_zip_post = z.infer<
  typeof Body_create_recipe_from_zip_api_recipes_create_zip_post
>;
export const Body_create_recipe_from_zip_api_recipes_create_zip_post = z.object({
  archive: z.string(),
});

export type Body_debug_openai_api_admin_debug_openai_post = z.infer<
  typeof Body_debug_openai_api_admin_debug_openai_post
>;
export const Body_debug_openai_api_admin_debug_openai_post = z.object({
  image: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
});

export type Body_get_token_api_auth_token_post = z.infer<typeof Body_get_token_api_auth_token_post>;
export const Body_get_token_api_auth_token_post = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  remember_me: z.boolean().optional(),
});

export type SupportedMigrations = z.infer<typeof SupportedMigrations>;
export const SupportedMigrations = z.union([
  z.literal("nextcloud"),
  z.literal("chowdown"),
  z.literal("copymethat"),
  z.literal("paprika"),
  z.literal("mealie_alpha"),
  z.literal("tandoor"),
  z.literal("plantoeat"),
  z.literal("myrecipebox"),
  z.literal("recipekeeper"),
]);

export type Body_start_data_migration_api_groups_migrations_post = z.infer<
  typeof Body_start_data_migration_api_groups_migrations_post
>;
export const Body_start_data_migration_api_groups_migrations_post = z.object({
  add_migration_tag: z.union([z.boolean(), z.undefined()]).optional(),
  migration_type: SupportedMigrations,
  archive: z.string(),
});

export type Body_update_event_image_api_recipes_timeline_events__item_id__image_put = z.infer<
  typeof Body_update_event_image_api_recipes_timeline_events__item_id__image_put
>;
export const Body_update_event_image_api_recipes_timeline_events__item_id__image_put = z.object({
  image: z.string(),
  extension: z.string(),
});

export type Body_update_recipe_image_api_recipes__slug__image_put = z.infer<
  typeof Body_update_recipe_image_api_recipes__slug__image_put
>;
export const Body_update_recipe_image_api_recipes__slug__image_put = z.object({
  image: z.string(),
  extension: z.string(),
});

export type Body_update_user_image_api_users__id__image_post = z.infer<
  typeof Body_update_user_image_api_users__id__image_post
>;
export const Body_update_user_image_api_users__id__image_post = z.object({
  profile: z.string(),
});

export type Body_upload_one_api_admin_backups_upload_post = z.infer<
  typeof Body_upload_one_api_admin_backups_upload_post
>;
export const Body_upload_one_api_admin_backups_upload_post = z.object({
  archive: z.string(),
});

export type Body_upload_recipe_asset_api_recipes__slug__assets_post = z.infer<
  typeof Body_upload_recipe_asset_api_recipes__slug__assets_post
>;
export const Body_upload_recipe_asset_api_recipes__slug__assets_post = z.object({
  name: z.string(),
  icon: z.string(),
  extension: z.string(),
  file: z.string(),
});

export type CategoryIn = z.infer<typeof CategoryIn>;
export const CategoryIn = z.object({
  name: z.string(),
});

export type CategoryOut = z.infer<typeof CategoryOut>;
export const CategoryOut = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
  groupId: z.string(),
});

export type CategorySummary = z.infer<typeof CategorySummary>;
export const CategorySummary = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});

export type ChangePassword = z.infer<typeof ChangePassword>;
export const ChangePassword = z.object({
  currentPassword: z.union([z.string(), z.undefined()]).optional(),
  newPassword: z.string(),
});

export type CheckAppConfig = z.infer<typeof CheckAppConfig>;
export const CheckAppConfig = z.object({
  emailReady: z.boolean(),
  ldapReady: z.boolean(),
  oidcReady: z.boolean(),
  enableOpenai: z.boolean(),
  baseUrlSet: z.boolean(),
  isUpToDate: z.boolean(),
});

export type LogicalOperator = z.infer<typeof LogicalOperator>;
export const LogicalOperator = z.union([z.literal("AND"), z.literal("OR")]);

export type RelationalKeyword = z.infer<typeof RelationalKeyword>;
export const RelationalKeyword = z.union([
  z.literal("IS"),
  z.literal("IS NOT"),
  z.literal("IN"),
  z.literal("NOT IN"),
  z.literal("CONTAINS ALL"),
  z.literal("LIKE"),
  z.literal("NOT LIKE"),
]);

export type RelationalOperator = z.infer<typeof RelationalOperator>;
export const RelationalOperator = z.union([
  z.literal("="),
  z.literal("<>"),
  z.literal(">"),
  z.literal("<"),
  z.literal(">="),
  z.literal("<="),
]);

export type QueryFilterJSONPart = z.infer<typeof QueryFilterJSONPart>;
export const QueryFilterJSONPart = z.object({
  leftParenthesis: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  rightParenthesis: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  logicalOperator: z.union([LogicalOperator, z.null(), z.array(z.union([LogicalOperator, z.null()]))]).optional(),
  attributeName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  relationalOperator: z
    .union([
      RelationalKeyword,
      RelationalOperator,
      z.null(),
      z.array(z.union([RelationalKeyword, RelationalOperator, z.null()])),
    ])
    .optional(),
  value: z
    .union([z.string(), z.array(z.string()), z.null(), z.array(z.union([z.string(), z.array(z.string()), z.null()]))])
    .optional(),
});

export type QueryFilterJSON = z.infer<typeof QueryFilterJSON>;
export const QueryFilterJSON = z.object({
  parts: z.array(QueryFilterJSONPart).optional(),
});

export type ReadCookBook = z.infer<typeof ReadCookBook>;
export const ReadCookBook = z.object({
  name: z.string(),
  description: z.union([z.string(), z.undefined()]).optional(),
  slug: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  public: z.union([z.boolean(), z.undefined()]).optional(),
  queryFilterString: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  householdId: z.string(),
  id: z.string(),
  queryFilter: z.union([QueryFilterJSON, z.undefined()]).optional(),
});

export type CookBookPagination = z.infer<typeof CookBookPagination>;
export const CookBookPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(ReadCookBook),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type CreateCookBook = z.infer<typeof CreateCookBook>;
export const CreateCookBook = z.object({
  name: z.string(),
  description: z.union([z.string(), z.undefined()]).optional(),
  slug: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  public: z.union([z.boolean(), z.undefined()]).optional(),
  queryFilterString: z.union([z.string(), z.undefined()]).optional(),
});

export type GroupRecipeActionType = z.infer<typeof GroupRecipeActionType>;
export const GroupRecipeActionType = z.union([z.literal("link"), z.literal("post")]);

export type CreateGroupRecipeAction = z.infer<typeof CreateGroupRecipeAction>;
export const CreateGroupRecipeAction = z.object({
  actionType: GroupRecipeActionType,
  title: z.string(),
  url: z.string(),
});

export type CreateIngredientFoodAlias = z.infer<typeof CreateIngredientFoodAlias>;
export const CreateIngredientFoodAlias = z.object({
  name: z.string(),
});

export type CreateIngredientFood = z.infer<typeof CreateIngredientFood>;
export const CreateIngredientFood = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  name: z.string(),
  pluralName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  description: z.union([z.string(), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  aliases: z.union([z.array(CreateIngredientFoodAlias), z.undefined()]).optional(),
  householdsWithIngredientFood: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type CreateIngredientUnitAlias = z.infer<typeof CreateIngredientUnitAlias>;
export const CreateIngredientUnitAlias = z.object({
  name: z.string(),
});

export type CreateIngredientUnit = z.infer<typeof CreateIngredientUnit>;
export const CreateIngredientUnit = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  name: z.string(),
  pluralName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  description: z.union([z.string(), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  fraction: z.union([z.boolean(), z.undefined()]).optional(),
  abbreviation: z.union([z.string(), z.undefined()]).optional(),
  pluralAbbreviation: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()])
    .optional(),
  useAbbreviation: z.union([z.boolean(), z.undefined()]).optional(),
  aliases: z.union([z.array(CreateIngredientUnitAlias), z.undefined()]).optional(),
});

export type CreateInviteToken = z.infer<typeof CreateInviteToken>;
export const CreateInviteToken = z.object({
  uses: z.number(),
  groupId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  householdId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PlanEntryType = z.infer<typeof PlanEntryType>;
export const PlanEntryType = z.union([
  z.literal("breakfast"),
  z.literal("lunch"),
  z.literal("dinner"),
  z.literal("side"),
]);

export type CreatePlanEntry = z.infer<typeof CreatePlanEntry>;
export const CreatePlanEntry = z.object({
  date: z.string(),
  entryType: z.union([PlanEntryType, z.undefined()]).optional(),
  title: z.union([z.string(), z.undefined()]).optional(),
  text: z.union([z.string(), z.undefined()]).optional(),
  recipeId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type CreateRandomEntry = z.infer<typeof CreateRandomEntry>;
export const CreateRandomEntry = z.object({
  date: z.string(),
  entryType: z.union([PlanEntryType, z.undefined()]).optional(),
});

export type CreateRecipe = z.infer<typeof CreateRecipe>;
export const CreateRecipe = z.object({
  name: z.string(),
});

export type RecipeCategory = z.infer<typeof RecipeCategory>;
export const RecipeCategory = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  name: z.string(),
  slug: z.string(),
});

export type RecipeTag = z.infer<typeof RecipeTag>;
export const RecipeTag = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  name: z.string(),
  slug: z.string(),
});

export type CreateRecipeBulk = z.infer<typeof CreateRecipeBulk>;
export const CreateRecipeBulk = z.object({
  url: z.string(),
  categories: z
    .union([z.array(RecipeCategory), z.null(), z.array(z.union([z.array(RecipeCategory), z.null()])), z.undefined()])
    .optional(),
  tags: z
    .union([z.array(RecipeTag), z.null(), z.array(z.union([z.array(RecipeTag), z.null()])), z.undefined()])
    .optional(),
});

export type CreateRecipeByUrlBulk = z.infer<typeof CreateRecipeByUrlBulk>;
export const CreateRecipeByUrlBulk = z.object({
  imports: z.array(CreateRecipeBulk),
});

export type CreateUserRegistration = z.infer<typeof CreateUserRegistration>;
export const CreateUserRegistration = z.object({
  group: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  household: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  groupToken: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  email: z.string(),
  username: z.string(),
  fullName: z.string(),
  password: z.string(),
  passwordConfirm: z.string(),
  advanced: z.union([z.boolean(), z.undefined()]).optional(),
  private: z.union([z.boolean(), z.undefined()]).optional(),
  seedData: z.union([z.boolean(), z.undefined()]).optional(),
  locale: z.union([z.string(), z.undefined()]).optional(),
});

export type WebhookType = z.infer<typeof WebhookType>;
export const WebhookType = z.literal("mealplan");

export type CreateWebhook = z.infer<typeof CreateWebhook>;
export const CreateWebhook = z.object({
  enabled: z.union([z.boolean(), z.undefined()]).optional(),
  name: z.union([z.string(), z.undefined()]).optional(),
  url: z.union([z.string(), z.undefined()]).optional(),
  webhookType: z.union([WebhookType, z.undefined()]).optional(),
  scheduledTime: z.string(),
});

export type DebugResponse = z.infer<typeof DebugResponse>;
export const DebugResponse = z.object({
  success: z.boolean(),
  response: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type DeleteRecipes = z.infer<typeof DeleteRecipes>;
export const DeleteRecipes = z.object({
  recipes: z.array(z.string()),
});

export type DeleteTokenResponse = z.infer<typeof DeleteTokenResponse>;
export const DeleteTokenResponse = z.object({
  tokenDelete: z.string(),
});

export type EmailInitationResponse = z.infer<typeof EmailInitationResponse>;
export const EmailInitationResponse = z.object({
  success: z.boolean(),
  error: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type EmailInvitation = z.infer<typeof EmailInvitation>;
export const EmailInvitation = z.object({
  email: z.string(),
  token: z.string(),
});

export type EmailReady = z.infer<typeof EmailReady>;
export const EmailReady = z.object({
  ready: z.boolean(),
});

export type EmailSuccess = z.infer<typeof EmailSuccess>;
export const EmailSuccess = z.object({
  success: z.boolean(),
  error: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type EmailTest = z.infer<typeof EmailTest>;
export const EmailTest = z.object({
  email: z.string(),
});

export type ExportTypes = z.infer<typeof ExportTypes>;
export const ExportTypes = z.literal("json");

export type ExportRecipes = z.infer<typeof ExportRecipes>;
export const ExportRecipes = z.object({
  recipes: z.array(z.string()),
  exportType: z.union([ExportTypes, z.undefined()]).optional(),
});

export type FileTokenResponse = z.infer<typeof FileTokenResponse>;
export const FileTokenResponse = z.object({
  fileToken: z.string(),
});

export type ForgotPassword = z.infer<typeof ForgotPassword>;
export const ForgotPassword = z.object({
  email: z.string(),
});

export type FormatResponse = z.infer<typeof FormatResponse>;
export const FormatResponse = z.object({
  json: z.array(z.string()),
  zip: z.array(z.string()),
  jinja2: z.array(z.string()),
});

export type UpdateGroupPreferences = z.infer<typeof UpdateGroupPreferences>;
export const UpdateGroupPreferences = z.object({
  privateGroup: z.boolean().optional(),
});

export type GroupAdminUpdate = z.infer<typeof GroupAdminUpdate>;
export const GroupAdminUpdate = z.object({
  id: z.string(),
  name: z.string(),
  preferences: z
    .union([UpdateGroupPreferences, z.null(), z.array(z.union([UpdateGroupPreferences, z.null()])), z.undefined()])
    .optional(),
});

export type GroupBase = z.infer<typeof GroupBase>;
export const GroupBase = z.object({
  name: z.string(),
});

export type GroupDataExport = z.infer<typeof GroupDataExport>;
export const GroupDataExport = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string(),
  filename: z.string(),
  path: z.string(),
  size: z.string(),
  expires: z.string(),
});

export type GroupEventNotifierCreate = z.infer<typeof GroupEventNotifierCreate>;
export const GroupEventNotifierCreate = z.object({
  name: z.string(),
  appriseUrl: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type GroupEventNotifierOptions = z.infer<typeof GroupEventNotifierOptions>;
export const GroupEventNotifierOptions = z.object({
  testMessage: z.boolean().optional(),
  webhookTask: z.boolean().optional(),
  recipeCreated: z.boolean().optional(),
  recipeUpdated: z.boolean().optional(),
  recipeDeleted: z.boolean().optional(),
  userSignup: z.boolean().optional(),
  dataMigrations: z.boolean().optional(),
  dataExport: z.boolean().optional(),
  dataImport: z.boolean().optional(),
  mealplanEntryCreated: z.boolean().optional(),
  shoppingListCreated: z.boolean().optional(),
  shoppingListUpdated: z.boolean().optional(),
  shoppingListDeleted: z.boolean().optional(),
  cookbookCreated: z.boolean().optional(),
  cookbookUpdated: z.boolean().optional(),
  cookbookDeleted: z.boolean().optional(),
  tagCreated: z.boolean().optional(),
  tagUpdated: z.boolean().optional(),
  tagDeleted: z.boolean().optional(),
  categoryCreated: z.boolean().optional(),
  categoryUpdated: z.boolean().optional(),
  categoryDeleted: z.boolean().optional(),
});

export type GroupEventNotifierOptionsOut = z.infer<typeof GroupEventNotifierOptionsOut>;
export const GroupEventNotifierOptionsOut = z.object({
  testMessage: z.union([z.boolean(), z.undefined()]).optional(),
  webhookTask: z.union([z.boolean(), z.undefined()]).optional(),
  recipeCreated: z.union([z.boolean(), z.undefined()]).optional(),
  recipeUpdated: z.union([z.boolean(), z.undefined()]).optional(),
  recipeDeleted: z.union([z.boolean(), z.undefined()]).optional(),
  userSignup: z.union([z.boolean(), z.undefined()]).optional(),
  dataMigrations: z.union([z.boolean(), z.undefined()]).optional(),
  dataExport: z.union([z.boolean(), z.undefined()]).optional(),
  dataImport: z.union([z.boolean(), z.undefined()]).optional(),
  mealplanEntryCreated: z.union([z.boolean(), z.undefined()]).optional(),
  shoppingListCreated: z.union([z.boolean(), z.undefined()]).optional(),
  shoppingListUpdated: z.union([z.boolean(), z.undefined()]).optional(),
  shoppingListDeleted: z.union([z.boolean(), z.undefined()]).optional(),
  cookbookCreated: z.union([z.boolean(), z.undefined()]).optional(),
  cookbookUpdated: z.union([z.boolean(), z.undefined()]).optional(),
  cookbookDeleted: z.union([z.boolean(), z.undefined()]).optional(),
  tagCreated: z.union([z.boolean(), z.undefined()]).optional(),
  tagUpdated: z.union([z.boolean(), z.undefined()]).optional(),
  tagDeleted: z.union([z.boolean(), z.undefined()]).optional(),
  categoryCreated: z.union([z.boolean(), z.undefined()]).optional(),
  categoryUpdated: z.union([z.boolean(), z.undefined()]).optional(),
  categoryDeleted: z.union([z.boolean(), z.undefined()]).optional(),
  id: z.string(),
});

export type GroupEventNotifierOut = z.infer<typeof GroupEventNotifierOut>;
export const GroupEventNotifierOut = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  groupId: z.string(),
  householdId: z.string(),
  options: GroupEventNotifierOptionsOut,
});

export type GroupEventNotifierUpdate = z.infer<typeof GroupEventNotifierUpdate>;
export const GroupEventNotifierUpdate = z.object({
  name: z.string(),
  appriseUrl: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  enabled: z.union([z.boolean(), z.undefined()]).optional(),
  groupId: z.string(),
  householdId: z.string(),
  options: z.union([GroupEventNotifierOptions, z.undefined()]).optional(),
  id: z.string(),
});

export type GroupEventPagination = z.infer<typeof GroupEventPagination>;
export const GroupEventPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(GroupEventNotifierOut),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type GroupHouseholdSummary = z.infer<typeof GroupHouseholdSummary>;
export const GroupHouseholdSummary = z.object({
  id: z.string(),
  name: z.string(),
});

export type ReadWebhook = z.infer<typeof ReadWebhook>;
export const ReadWebhook = z.object({
  enabled: z.union([z.boolean(), z.undefined()]).optional(),
  name: z.union([z.string(), z.undefined()]).optional(),
  url: z.union([z.string(), z.undefined()]).optional(),
  webhookType: z.union([WebhookType, z.undefined()]).optional(),
  scheduledTime: z.string(),
  groupId: z.string(),
  householdId: z.string(),
  id: z.string(),
});

export type UserSummary = z.infer<typeof UserSummary>;
export const UserSummary = z.object({
  id: z.string(),
  groupId: z.string(),
  householdId: z.string(),
  username: z.string(),
  fullName: z.string(),
});

export type ReadGroupPreferences = z.infer<typeof ReadGroupPreferences>;
export const ReadGroupPreferences = z.object({
  privateGroup: z.union([z.boolean(), z.undefined()]).optional(),
  groupId: z.string(),
  id: z.string(),
});

export type GroupInDB = z.infer<typeof GroupInDB>;
export const GroupInDB = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
  categories: z
    .union([z.array(CategoryBase), z.null(), z.array(z.union([z.array(CategoryBase), z.null()])), z.undefined()])
    .optional(),
  webhooks: z.union([z.array(ReadWebhook), z.undefined()]).optional(),
  households: z
    .union([
      z.array(GroupHouseholdSummary),
      z.null(),
      z.array(z.union([z.array(GroupHouseholdSummary), z.null()])),
      z.undefined(),
    ])
    .optional(),
  users: z
    .union([z.array(UserSummary), z.null(), z.array(z.union([z.array(UserSummary), z.null()])), z.undefined()])
    .optional(),
  preferences: z
    .union([ReadGroupPreferences, z.null(), z.array(z.union([ReadGroupPreferences, z.null()])), z.undefined()])
    .optional(),
});

export type GroupPagination = z.infer<typeof GroupPagination>;
export const GroupPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(GroupInDB),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type GroupRecipeActionOut = z.infer<typeof GroupRecipeActionOut>;
export const GroupRecipeActionOut = z.object({
  actionType: GroupRecipeActionType,
  title: z.string(),
  url: z.string(),
  groupId: z.string(),
  householdId: z.string(),
  id: z.string(),
});

export type GroupRecipeActionPagination = z.infer<typeof GroupRecipeActionPagination>;
export const GroupRecipeActionPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(GroupRecipeActionOut),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type GroupStorage = z.infer<typeof GroupStorage>;
export const GroupStorage = z.object({
  usedStorageBytes: z.number(),
  usedStorageStr: z.string(),
  totalStorageBytes: z.number(),
  totalStorageStr: z.string(),
});

export type GroupSummary = z.infer<typeof GroupSummary>;
export const GroupSummary = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
  preferences: z
    .union([ReadGroupPreferences, z.null(), z.array(z.union([ReadGroupPreferences, z.null()])), z.undefined()])
    .optional(),
});

export type ValidationError = z.infer<typeof ValidationError>;
export const ValidationError = z.object({
  loc: z.array(z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])),
  msg: z.string(),
  type: z.string(),
});

export type HTTPValidationError = z.infer<typeof HTTPValidationError>;
export const HTTPValidationError = z.object({
  detail: z.array(ValidationError).optional(),
});

export type HouseholdCreate = z.infer<typeof HouseholdCreate>;
export const HouseholdCreate = z.object({
  groupId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  name: z.string(),
});

export type ReadHouseholdPreferences = z.infer<typeof ReadHouseholdPreferences>;
export const ReadHouseholdPreferences = z.object({
  privateHousehold: z.union([z.boolean(), z.undefined()]).optional(),
  lockRecipeEditsFromOtherHouseholds: z.union([z.boolean(), z.undefined()]).optional(),
  firstDayOfWeek: z.union([z.number(), z.undefined()]).optional(),
  recipePublic: z.union([z.boolean(), z.undefined()]).optional(),
  recipeShowNutrition: z.union([z.boolean(), z.undefined()]).optional(),
  recipeShowAssets: z.union([z.boolean(), z.undefined()]).optional(),
  recipeLandscapeView: z.union([z.boolean(), z.undefined()]).optional(),
  recipeDisableComments: z.union([z.boolean(), z.undefined()]).optional(),
  recipeDisableAmount: z.union([z.boolean(), z.undefined()]).optional(),
  id: z.string(),
});

export type HouseholdUserSummary = z.infer<typeof HouseholdUserSummary>;
export const HouseholdUserSummary = z.object({
  id: z.string(),
  fullName: z.string(),
});

export type HouseholdInDB = z.infer<typeof HouseholdInDB>;
export const HouseholdInDB = z.object({
  groupId: z.string(),
  name: z.string(),
  id: z.string(),
  slug: z.string(),
  preferences: z
    .union([ReadHouseholdPreferences, z.null(), z.array(z.union([ReadHouseholdPreferences, z.null()])), z.undefined()])
    .optional(),
  group: z.string(),
  users: z
    .union([
      z.array(HouseholdUserSummary),
      z.null(),
      z.array(z.union([z.array(HouseholdUserSummary), z.null()])),
      z.undefined(),
    ])
    .optional(),
  webhooks: z.union([z.array(ReadWebhook), z.undefined()]).optional(),
});

export type HouseholdPagination = z.infer<typeof HouseholdPagination>;
export const HouseholdPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(HouseholdInDB),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type HouseholdRecipeSummary = z.infer<typeof HouseholdRecipeSummary>;
export const HouseholdRecipeSummary = z.object({
  lastMade: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  recipeId: z.string(),
});

export type HouseholdStatistics = z.infer<typeof HouseholdStatistics>;
export const HouseholdStatistics = z.object({
  totalRecipes: z.number(),
  totalUsers: z.number(),
  totalCategories: z.number(),
  totalTags: z.number(),
  totalTools: z.number(),
});

export type HouseholdSummary = z.infer<typeof HouseholdSummary>;
export const HouseholdSummary = z.object({
  groupId: z.string(),
  name: z.string(),
  id: z.string(),
  slug: z.string(),
  preferences: z
    .union([ReadHouseholdPreferences, z.null(), z.array(z.union([ReadHouseholdPreferences, z.null()])), z.undefined()])
    .optional(),
});

export type ImageType = z.infer<typeof ImageType>;
export const ImageType = z.union([
  z.literal("original.webp"),
  z.literal("min-original.webp"),
  z.literal("tiny-original.webp"),
]);

export type IngredientConfidence = z.infer<typeof IngredientConfidence>;
export const IngredientConfidence = z.object({
  average: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  comment: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  name: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  unit: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  quantity: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  food: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
});

export type IngredientFoodAlias = z.infer<typeof IngredientFoodAlias>;
export const IngredientFoodAlias = z.object({
  name: z.string(),
});

export type MultiPurposeLabelSummary = z.infer<typeof MultiPurposeLabelSummary>;
export const MultiPurposeLabelSummary = z.object({
  name: z.string(),
  color: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  id: z.string(),
});

export type IngredientFood_Input = z.infer<typeof IngredientFood_Input>;
export const IngredientFood_Input = z.object({
  id: z.string(),
  name: z.string(),
  pluralName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  description: z.union([z.string(), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  aliases: z.union([z.array(IngredientFoodAlias), z.undefined()]).optional(),
  householdsWithIngredientFood: z.union([z.array(z.string()), z.undefined()]).optional(),
  label: z
    .union([MultiPurposeLabelSummary, z.null(), z.array(z.union([MultiPurposeLabelSummary, z.null()])), z.undefined()])
    .optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  update_at: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type IngredientFood_Output = z.infer<typeof IngredientFood_Output>;
export const IngredientFood_Output = z.object({
  id: z.string(),
  name: z.string(),
  pluralName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  description: z.union([z.string(), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  aliases: z.union([z.array(IngredientFoodAlias), z.undefined()]).optional(),
  householdsWithIngredientFood: z.union([z.array(z.string()), z.undefined()]).optional(),
  label: z
    .union([MultiPurposeLabelSummary, z.null(), z.array(z.union([MultiPurposeLabelSummary, z.null()])), z.undefined()])
    .optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type IngredientFoodPagination = z.infer<typeof IngredientFoodPagination>;
export const IngredientFoodPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(IngredientFood_Output),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type IngredientReferences = z.infer<typeof IngredientReferences>;
export const IngredientReferences = z.object({
  referenceId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
});

export type RegisteredParser = z.infer<typeof RegisteredParser>;
export const RegisteredParser = z.union([z.literal("nlp"), z.literal("brute"), z.literal("openai")]);

export type IngredientRequest = z.infer<typeof IngredientRequest>;
export const IngredientRequest = z.object({
  parser: z.union([RegisteredParser, z.undefined()]).optional(),
  ingredient: z.string(),
});

export type IngredientUnitAlias = z.infer<typeof IngredientUnitAlias>;
export const IngredientUnitAlias = z.object({
  name: z.string(),
});

export type IngredientUnit_Input = z.infer<typeof IngredientUnit_Input>;
export const IngredientUnit_Input = z.object({
  id: z.string(),
  name: z.string(),
  pluralName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  description: z.union([z.string(), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  fraction: z.union([z.boolean(), z.undefined()]).optional(),
  abbreviation: z.union([z.string(), z.undefined()]).optional(),
  pluralAbbreviation: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()])
    .optional(),
  useAbbreviation: z.union([z.boolean(), z.undefined()]).optional(),
  aliases: z.union([z.array(IngredientUnitAlias), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  update_at: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type IngredientUnit_Output = z.infer<typeof IngredientUnit_Output>;
export const IngredientUnit_Output = z.object({
  id: z.string(),
  name: z.string(),
  pluralName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  description: z.union([z.string(), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  fraction: z.union([z.boolean(), z.undefined()]).optional(),
  abbreviation: z.union([z.string(), z.undefined()]).optional(),
  pluralAbbreviation: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()])
    .optional(),
  useAbbreviation: z.union([z.boolean(), z.undefined()]).optional(),
  aliases: z.union([z.array(IngredientUnitAlias), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type IngredientUnitPagination = z.infer<typeof IngredientUnitPagination>;
export const IngredientUnitPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(IngredientUnit_Output),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type IngredientsRequest = z.infer<typeof IngredientsRequest>;
export const IngredientsRequest = z.object({
  parser: z.union([RegisteredParser, z.undefined()]).optional(),
  ingredients: z.array(z.string()),
});

export type LongLiveTokenCreateResponse = z.infer<typeof LongLiveTokenCreateResponse>;
export const LongLiveTokenCreateResponse = z.object({
  name: z.string(),
  id: z.number(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  token: z.string(),
});

export type LongLiveTokenIn = z.infer<typeof LongLiveTokenIn>;
export const LongLiveTokenIn = z.object({
  name: z.string(),
  integrationId: z.union([z.string(), z.undefined()]).optional(),
});

export type LongLiveTokenOut = z.infer<typeof LongLiveTokenOut>;
export const LongLiveTokenOut = z.object({
  name: z.string(),
  id: z.number(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type MaintenanceStorageDetails = z.infer<typeof MaintenanceStorageDetails>;
export const MaintenanceStorageDetails = z.object({
  tempDirSize: z.string(),
  backupsDirSize: z.string(),
  groupsDirSize: z.string(),
  recipesDirSize: z.string(),
  userDirSize: z.string(),
});

export type MaintenanceSummary = z.infer<typeof MaintenanceSummary>;
export const MaintenanceSummary = z.object({
  dataDirSize: z.string(),
  cleanableImages: z.number(),
  cleanableDirs: z.number(),
});

export type MergeFood = z.infer<typeof MergeFood>;
export const MergeFood = z.object({
  fromFood: z.string(),
  toFood: z.string(),
});

export type MergeUnit = z.infer<typeof MergeUnit>;
export const MergeUnit = z.object({
  fromUnit: z.string(),
  toUnit: z.string(),
});

export type MultiPurposeLabelCreate = z.infer<typeof MultiPurposeLabelCreate>;
export const MultiPurposeLabelCreate = z.object({
  name: z.string(),
  color: z.union([z.string(), z.undefined()]).optional(),
});

export type MultiPurposeLabelOut = z.infer<typeof MultiPurposeLabelOut>;
export const MultiPurposeLabelOut = z.object({
  name: z.string(),
  color: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  id: z.string(),
});

export type MultiPurposeLabelPagination = z.infer<typeof MultiPurposeLabelPagination>;
export const MultiPurposeLabelPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(MultiPurposeLabelSummary),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type MultiPurposeLabelUpdate = z.infer<typeof MultiPurposeLabelUpdate>;
export const MultiPurposeLabelUpdate = z.object({
  name: z.string(),
  color: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  id: z.string(),
});

export type Nutrition = z.infer<typeof Nutrition>;
export const Nutrition = z.object({
  calories: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  carbohydrateContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  cholesterolContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  fatContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  fiberContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  proteinContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  saturatedFatContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  sodiumContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  sugarContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  transFatContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  unsaturatedFatContent: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
});

export type OrderByNullPosition = z.infer<typeof OrderByNullPosition>;
export const OrderByNullPosition = z.union([z.literal("first"), z.literal("last")]);

export type OrderDirection = z.infer<typeof OrderDirection>;
export const OrderDirection = z.union([z.literal("asc"), z.literal("desc")]);

export type PaginationBase_HouseholdSummary_ = z.infer<typeof PaginationBase_HouseholdSummary_>;
export const PaginationBase_HouseholdSummary_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(HouseholdSummary),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PaginationBase_IngredientFood_ = z.infer<typeof PaginationBase_IngredientFood_>;
export const PaginationBase_IngredientFood_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(IngredientFood_Output),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PaginationBase_ReadCookBook_ = z.infer<typeof PaginationBase_ReadCookBook_>;
export const PaginationBase_ReadCookBook_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(ReadCookBook),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PaginationBase_RecipeCategory_ = z.infer<typeof PaginationBase_RecipeCategory_>;
export const PaginationBase_RecipeCategory_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeCategory),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeTool = z.infer<typeof RecipeTool>;
export const RecipeTool = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  householdsWithTool: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type RecipeSummary = z.infer<typeof RecipeSummary>;
export const RecipeSummary = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  userId: z.string().optional(),
  householdId: z.string().optional(),
  groupId: z.string().optional(),
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  slug: z.string().optional(),
  image: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))]).optional(),
  recipeServings: z.number().optional(),
  recipeYieldQuantity: z.number().optional(),
  recipeYield: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  totalTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  prepTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  cookTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  performTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  description: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  recipeCategory: z
    .union([z.array(RecipeCategory), z.null(), z.array(z.union([z.array(RecipeCategory), z.null()]))])
    .optional(),
  tags: z.union([z.array(RecipeTag), z.null(), z.array(z.union([z.array(RecipeTag), z.null()]))]).optional(),
  tools: z.array(RecipeTool).optional(),
  rating: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  orgURL: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  dateAdded: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  dateUpdated: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  lastMade: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
});

export type PaginationBase_RecipeSummary_ = z.infer<typeof PaginationBase_RecipeSummary_>;
export const PaginationBase_RecipeSummary_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeSummary),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PaginationBase_RecipeTag_ = z.infer<typeof PaginationBase_RecipeTag_>;
export const PaginationBase_RecipeTag_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeTag),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PaginationBase_RecipeTool_ = z.infer<typeof PaginationBase_RecipeTool_>;
export const PaginationBase_RecipeTool_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeTool),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type UserOut = z.infer<typeof UserOut>;
export const UserOut = z.object({
  id: z.string(),
  username: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  fullName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  email: z.string(),
  authMethod: z.union([AuthMethod, z.undefined()]).optional(),
  admin: z.union([z.boolean(), z.undefined()]).optional(),
  group: z.string(),
  household: z.string(),
  advanced: z.union([z.boolean(), z.undefined()]).optional(),
  canInvite: z.union([z.boolean(), z.undefined()]).optional(),
  canManage: z.union([z.boolean(), z.undefined()]).optional(),
  canManageHousehold: z.union([z.boolean(), z.undefined()]).optional(),
  canOrganize: z.union([z.boolean(), z.undefined()]).optional(),
  groupId: z.string(),
  groupSlug: z.string(),
  householdId: z.string(),
  householdSlug: z.string(),
  tokens: z
    .union([
      z.array(LongLiveTokenOut),
      z.null(),
      z.array(z.union([z.array(LongLiveTokenOut), z.null()])),
      z.undefined(),
    ])
    .optional(),
  cacheKey: z.string(),
});

export type PaginationBase_UserOut_ = z.infer<typeof PaginationBase_UserOut_>;
export const PaginationBase_UserOut_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(UserOut),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PaginationBase_UserSummary_ = z.infer<typeof PaginationBase_UserSummary_>;
export const PaginationBase_UserSummary_ = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(UserSummary),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeIngredient_Output = z.infer<typeof RecipeIngredient_Output>;
export const RecipeIngredient_Output = z.object({
  quantity: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  unit: z
    .union([
      IngredientUnit_Output,
      CreateIngredientUnit,
      z.null(),
      z.array(z.union([IngredientUnit_Output, CreateIngredientUnit, z.null()])),
    ])
    .optional(),
  food: z
    .union([
      IngredientFood_Output,
      CreateIngredientFood,
      z.null(),
      z.array(z.union([IngredientFood_Output, CreateIngredientFood, z.null()])),
    ])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  isFood: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))]).optional(),
  disableAmount: z.boolean().optional(),
  display: z.string().optional(),
  title: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  originalText: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  referenceId: z.string().optional(),
});

export type ParsedIngredient = z.infer<typeof ParsedIngredient>;
export const ParsedIngredient = z.object({
  input: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  confidence: z.union([IngredientConfidence, z.undefined()]).optional(),
  ingredient: RecipeIngredient_Output,
});

export type PasswordResetToken = z.infer<typeof PasswordResetToken>;
export const PasswordResetToken = z.object({
  token: z.string(),
});

export type ReadPlanEntry = z.infer<typeof ReadPlanEntry>;
export const ReadPlanEntry = z.object({
  date: z.string(),
  entryType: z.union([PlanEntryType, z.undefined()]).optional(),
  title: z.union([z.string(), z.undefined()]).optional(),
  text: z.union([z.string(), z.undefined()]).optional(),
  recipeId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  id: z.number(),
  groupId: z.string(),
  userId: z.string(),
  householdId: z.string(),
  recipe: z.union([RecipeSummary, z.null(), z.array(z.union([RecipeSummary, z.null()])), z.undefined()]).optional(),
});

export type PlanEntryPagination = z.infer<typeof PlanEntryPagination>;
export const PlanEntryPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(ReadPlanEntry),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type PlanRulesDay = z.infer<typeof PlanRulesDay>;
export const PlanRulesDay = z.union([
  z.literal("monday"),
  z.literal("tuesday"),
  z.literal("wednesday"),
  z.literal("thursday"),
  z.literal("friday"),
  z.literal("saturday"),
  z.literal("sunday"),
  z.literal("unset"),
]);

export type PlanRulesType = z.infer<typeof PlanRulesType>;
export const PlanRulesType = z.union([
  z.literal("breakfast"),
  z.literal("lunch"),
  z.literal("dinner"),
  z.literal("side"),
  z.literal("unset"),
]);

export type PlanRulesCreate = z.infer<typeof PlanRulesCreate>;
export const PlanRulesCreate = z.object({
  day: PlanRulesDay.optional(),
  entryType: PlanRulesType.optional(),
  queryFilterString: z.string().optional(),
});

export type PlanRulesOut = z.infer<typeof PlanRulesOut>;
export const PlanRulesOut = z.object({
  day: z.union([PlanRulesDay, z.undefined()]).optional(),
  entryType: z.union([PlanRulesType, z.undefined()]).optional(),
  queryFilterString: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  householdId: z.string(),
  id: z.string(),
  queryFilter: z.union([QueryFilterJSON, z.undefined()]).optional(),
});

export type PlanRulesPagination = z.infer<typeof PlanRulesPagination>;
export const PlanRulesPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(PlanRulesOut),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type ReadInviteToken = z.infer<typeof ReadInviteToken>;
export const ReadInviteToken = z.object({
  token: z.string(),
  usesLeft: z.number(),
  groupId: z.string(),
  householdId: z.string(),
});

export type RecipeIngredient_Input = z.infer<typeof RecipeIngredient_Input>;
export const RecipeIngredient_Input = z.object({
  quantity: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  unit: z
    .union([
      IngredientUnit_Input,
      CreateIngredientUnit,
      z.null(),
      z.array(z.union([IngredientUnit_Input, CreateIngredientUnit, z.null()])),
    ])
    .optional(),
  food: z
    .union([
      IngredientFood_Input,
      CreateIngredientFood,
      z.null(),
      z.array(z.union([IngredientFood_Input, CreateIngredientFood, z.null()])),
    ])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  isFood: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))]).optional(),
  disableAmount: z.boolean().optional(),
  display: z.string().optional(),
  title: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  originalText: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  referenceId: z.string().optional(),
});

export type RecipeStep = z.infer<typeof RecipeStep>;
export const RecipeStep = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  title: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  summary: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  text: z.string(),
  ingredientReferences: z.union([z.array(IngredientReferences), z.undefined()]).optional(),
});

export type RecipeAsset = z.infer<typeof RecipeAsset>;
export const RecipeAsset = z.object({
  name: z.string(),
  icon: z.string(),
  fileName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeNote = z.infer<typeof RecipeNote>;
export const RecipeNote = z.object({
  title: z.string(),
  text: z.string(),
});

export type mealie__schema__recipe__recipe_comments__UserBase = z.infer<
  typeof mealie__schema__recipe__recipe_comments__UserBase
>;
export const mealie__schema__recipe__recipe_comments__UserBase = z.object({
  id: z.string(),
  username: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  admin: z.boolean(),
  fullName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeCommentOut_Input = z.infer<typeof RecipeCommentOut_Input>;
export const RecipeCommentOut_Input = z.object({
  recipeId: z.string(),
  text: z.string(),
  id: z.string(),
  createdAt: z.string(),
  update_at: z.string(),
  userId: z.string(),
  user: mealie__schema__recipe__recipe_comments__UserBase,
});

export type Recipe_Input = z.infer<typeof Recipe_Input>;
export const Recipe_Input = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  userId: z.string().optional(),
  householdId: z.string().optional(),
  groupId: z.string().optional(),
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  slug: z.string().optional(),
  image: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))]).optional(),
  recipeServings: z.number().optional(),
  recipeYieldQuantity: z.number().optional(),
  recipeYield: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  totalTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  prepTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  cookTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  performTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  description: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  recipeCategory: z
    .union([z.array(RecipeCategory), z.null(), z.array(z.union([z.array(RecipeCategory), z.null()]))])
    .optional(),
  tags: z.union([z.array(RecipeTag), z.null(), z.array(z.union([z.array(RecipeTag), z.null()]))]).optional(),
  tools: z.array(RecipeTool).optional(),
  rating: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  orgURL: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  dateAdded: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  dateUpdated: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  update_at: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  lastMade: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  recipeIngredient: z.array(RecipeIngredient_Input).optional(),
  recipeInstructions: z
    .union([z.array(RecipeStep), z.null(), z.array(z.union([z.array(RecipeStep), z.null()]))])
    .optional(),
  nutrition: z.union([Nutrition, z.null(), z.array(z.union([Nutrition, z.null()]))]).optional(),
  settings: z.union([RecipeSettings, z.null(), z.array(z.union([RecipeSettings, z.null()]))]).optional(),
  assets: z.union([z.array(RecipeAsset), z.null(), z.array(z.union([z.array(RecipeAsset), z.null()]))]).optional(),
  notes: z.union([z.array(RecipeNote), z.null(), z.array(z.union([z.array(RecipeNote), z.null()]))]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))]).optional(),
  comments: z
    .union([z.array(RecipeCommentOut_Input), z.null(), z.array(z.union([z.array(RecipeCommentOut_Input), z.null()]))])
    .optional(),
});

export type UserBase_Output = z.infer<typeof UserBase_Output>;
export const UserBase_Output = z.object({
  id: z.string(),
  username: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  admin: z.boolean(),
  fullName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeCommentOut_Output = z.infer<typeof RecipeCommentOut_Output>;
export const RecipeCommentOut_Output = z.object({
  recipeId: z.string(),
  text: z.string(),
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
  user: UserBase_Output,
});

export type Recipe_Output = z.infer<typeof Recipe_Output>;
export const Recipe_Output = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  userId: z.string().optional(),
  householdId: z.string().optional(),
  groupId: z.string().optional(),
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  slug: z.string().optional(),
  image: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))]).optional(),
  recipeServings: z.number().optional(),
  recipeYieldQuantity: z.number().optional(),
  recipeYield: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  totalTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  prepTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  cookTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  performTime: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  description: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  recipeCategory: z
    .union([z.array(RecipeCategory), z.null(), z.array(z.union([z.array(RecipeCategory), z.null()]))])
    .optional(),
  tags: z.union([z.array(RecipeTag), z.null(), z.array(z.union([z.array(RecipeTag), z.null()]))]).optional(),
  tools: z.array(RecipeTool).optional(),
  rating: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  orgURL: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  dateAdded: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  dateUpdated: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  lastMade: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  recipeIngredient: z.array(RecipeIngredient_Output).optional(),
  recipeInstructions: z
    .union([z.array(RecipeStep), z.null(), z.array(z.union([z.array(RecipeStep), z.null()]))])
    .optional(),
  nutrition: z.union([Nutrition, z.null(), z.array(z.union([Nutrition, z.null()]))]).optional(),
  settings: z.union([RecipeSettings, z.null(), z.array(z.union([RecipeSettings, z.null()]))]).optional(),
  assets: z.union([z.array(RecipeAsset), z.null(), z.array(z.union([z.array(RecipeAsset), z.null()]))]).optional(),
  notes: z.union([z.array(RecipeNote), z.null(), z.array(z.union([z.array(RecipeNote), z.null()]))]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))]).optional(),
  comments: z
    .union([z.array(RecipeCommentOut_Output), z.null(), z.array(z.union([z.array(RecipeCommentOut_Output), z.null()]))])
    .optional(),
});

export type RecipeCategoryPagination = z.infer<typeof RecipeCategoryPagination>;
export const RecipeCategoryPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeCategory),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeCommentCreate = z.infer<typeof RecipeCommentCreate>;
export const RecipeCommentCreate = z.object({
  recipeId: z.string(),
  text: z.string(),
});

export type RecipeCommentPagination = z.infer<typeof RecipeCommentPagination>;
export const RecipeCommentPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeCommentOut_Output),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeCommentUpdate = z.infer<typeof RecipeCommentUpdate>;
export const RecipeCommentUpdate = z.object({
  id: z.string(),
  text: z.string(),
});

export type RecipeCookBook = z.infer<typeof RecipeCookBook>;
export const RecipeCookBook = z.object({
  name: z.string(),
  description: z.union([z.string(), z.undefined()]).optional(),
  slug: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  public: z.union([z.boolean(), z.undefined()]).optional(),
  queryFilterString: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  householdId: z.string(),
  id: z.string(),
  queryFilter: z.union([QueryFilterJSON, z.undefined()]).optional(),
  recipes: z.array(RecipeSummary),
});

export type RecipeDuplicate = z.infer<typeof RecipeDuplicate>;
export const RecipeDuplicate = z.object({
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
});

export type RecipeLastMade = z.infer<typeof RecipeLastMade>;
export const RecipeLastMade = z.object({
  timestamp: z.string(),
});

export type RecipeShareToken = z.infer<typeof RecipeShareToken>;
export const RecipeShareToken = z.object({
  recipeId: z.string(),
  expiresAt: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  id: z.string(),
  createdAt: z.string(),
  recipe: Recipe_Output,
});

export type RecipeShareTokenCreate = z.infer<typeof RecipeShareTokenCreate>;
export const RecipeShareTokenCreate = z.object({
  recipeId: z.string(),
  expiresAt: z.union([z.string(), z.undefined()]).optional(),
});

export type RecipeShareTokenSummary = z.infer<typeof RecipeShareTokenSummary>;
export const RecipeShareTokenSummary = z.object({
  recipeId: z.string(),
  expiresAt: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  id: z.string(),
  createdAt: z.string(),
});

export type RecipeSuggestionResponseItem = z.infer<typeof RecipeSuggestionResponseItem>;
export const RecipeSuggestionResponseItem = z.object({
  recipe: RecipeSummary,
  missingFoods: z.array(IngredientFood_Output),
  missingTools: z.array(RecipeTool),
});

export type RecipeSuggestionResponse = z.infer<typeof RecipeSuggestionResponse>;
export const RecipeSuggestionResponse = z.object({
  items: z.array(RecipeSuggestionResponseItem),
});

export type RecipeTagPagination = z.infer<typeof RecipeTagPagination>;
export const RecipeTagPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeTag),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeTagResponse = z.infer<typeof RecipeTagResponse>;
export const RecipeTagResponse = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
  recipes: z.union([z.array(RecipeSummary), z.undefined()]).optional(),
});

export type TimelineEventType = z.infer<typeof TimelineEventType>;
export const TimelineEventType = z.union([z.literal("system"), z.literal("info"), z.literal("comment")]);

export type TimelineEventImage = z.infer<typeof TimelineEventImage>;
export const TimelineEventImage = z.union([z.literal("has image"), z.literal("does not have image")]);

export type RecipeTimelineEventIn = z.infer<typeof RecipeTimelineEventIn>;
export const RecipeTimelineEventIn = z.object({
  recipeId: z.string(),
  userId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  subject: z.string(),
  eventType: TimelineEventType,
  eventMessage: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  image: z
    .union([TimelineEventImage, z.null(), z.array(z.union([TimelineEventImage, z.null()])), z.undefined()])
    .optional(),
  timestamp: z.union([z.string(), z.undefined()]).optional(),
});

export type RecipeTimelineEventOut = z.infer<typeof RecipeTimelineEventOut>;
export const RecipeTimelineEventOut = z.object({
  recipeId: z.string(),
  userId: z.string(),
  subject: z.string(),
  eventType: TimelineEventType,
  eventMessage: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  image: z
    .union([TimelineEventImage, z.null(), z.array(z.union([TimelineEventImage, z.null()])), z.undefined()])
    .optional(),
  timestamp: z.union([z.string(), z.undefined()]).optional(),
  id: z.string(),
  groupId: z.string(),
  householdId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RecipeTimelineEventPagination = z.infer<typeof RecipeTimelineEventPagination>;
export const RecipeTimelineEventPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeTimelineEventOut),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeTimelineEventUpdate = z.infer<typeof RecipeTimelineEventUpdate>;
export const RecipeTimelineEventUpdate = z.object({
  subject: z.string(),
  eventMessage: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  image: z
    .union([TimelineEventImage, z.null(), z.array(z.union([TimelineEventImage, z.null()])), z.undefined()])
    .optional(),
});

export type RecipeToolCreate = z.infer<typeof RecipeToolCreate>;
export const RecipeToolCreate = z.object({
  name: z.string(),
  householdsWithTool: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type RecipeToolOut = z.infer<typeof RecipeToolOut>;
export const RecipeToolOut = z.object({
  name: z.string(),
  householdsWithTool: z.union([z.array(z.string()), z.undefined()]).optional(),
  id: z.string(),
  slug: z.string(),
});

export type RecipeToolPagination = z.infer<typeof RecipeToolPagination>;
export const RecipeToolPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(RecipeTool),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type RecipeToolResponse = z.infer<typeof RecipeToolResponse>;
export const RecipeToolResponse = z.object({
  name: z.string(),
  householdsWithTool: z.union([z.array(z.string()), z.undefined()]).optional(),
  id: z.string(),
  slug: z.string(),
  recipes: z.union([z.array(RecipeSummary), z.undefined()]).optional(),
});

export type RecipeZipTokenResponse = z.infer<typeof RecipeZipTokenResponse>;
export const RecipeZipTokenResponse = z.object({
  token: z.string(),
});

export type ReportCategory = z.infer<typeof ReportCategory>;
export const ReportCategory = z.union([
  z.literal("backup"),
  z.literal("restore"),
  z.literal("migration"),
  z.literal("bulk_import"),
]);

export type ReportEntryOut = z.infer<typeof ReportEntryOut>;
export const ReportEntryOut = z.object({
  reportId: z.string(),
  timestamp: z.union([z.string(), z.undefined()]).optional(),
  success: z.union([z.boolean(), z.undefined()]).optional(),
  message: z.string(),
  exception: z.union([z.string(), z.undefined()]).optional(),
  id: z.string(),
});

export type ReportSummaryStatus = z.infer<typeof ReportSummaryStatus>;
export const ReportSummaryStatus = z.union([
  z.literal("in-progress"),
  z.literal("success"),
  z.literal("failure"),
  z.literal("partial"),
]);

export type ReportOut = z.infer<typeof ReportOut>;
export const ReportOut = z.object({
  timestamp: z.union([z.string(), z.undefined()]).optional(),
  category: ReportCategory,
  groupId: z.string(),
  name: z.string(),
  status: z.union([ReportSummaryStatus, z.undefined()]).optional(),
  id: z.string(),
  entries: z.union([z.array(ReportEntryOut), z.undefined()]).optional(),
});

export type ReportSummary = z.infer<typeof ReportSummary>;
export const ReportSummary = z.object({
  timestamp: z.union([z.string(), z.undefined()]).optional(),
  category: ReportCategory,
  groupId: z.string(),
  name: z.string(),
  status: z.union([ReportSummaryStatus, z.undefined()]).optional(),
  id: z.string(),
});

export type ResetPassword = z.infer<typeof ResetPassword>;
export const ResetPassword = z.object({
  token: z.string(),
  email: z.string(),
  password: z.string(),
  passwordConfirm: z.string(),
});

export type SaveGroupRecipeAction = z.infer<typeof SaveGroupRecipeAction>;
export const SaveGroupRecipeAction = z.object({
  actionType: GroupRecipeActionType,
  title: z.string(),
  url: z.string(),
  groupId: z.string(),
  householdId: z.string(),
});

export type ScrapeRecipe = z.infer<typeof ScrapeRecipe>;
export const ScrapeRecipe = z.object({
  includeTags: z.union([z.boolean(), z.undefined()]).optional(),
  url: z.string(),
});

export type ScrapeRecipeData = z.infer<typeof ScrapeRecipeData>;
export const ScrapeRecipeData = z.object({
  includeTags: z.union([z.boolean(), z.undefined()]).optional(),
  data: z.string(),
});

export type ScrapeRecipeTest = z.infer<typeof ScrapeRecipeTest>;
export const ScrapeRecipeTest = z.object({
  url: z.string(),
  useOpenAI: z.union([z.boolean(), z.undefined()]).optional(),
});

export type SeederConfig = z.infer<typeof SeederConfig>;
export const SeederConfig = z.object({
  locale: z.string(),
});

export type SetPermissions = z.infer<typeof SetPermissions>;
export const SetPermissions = z.object({
  userId: z.string(),
  canManageHousehold: z.union([z.boolean(), z.undefined()]).optional(),
  canManage: z.union([z.boolean(), z.undefined()]).optional(),
  canInvite: z.union([z.boolean(), z.undefined()]).optional(),
  canOrganize: z.union([z.boolean(), z.undefined()]).optional(),
});

export type ShoppingListAddRecipeParams = z.infer<typeof ShoppingListAddRecipeParams>;
export const ShoppingListAddRecipeParams = z.object({
  recipeIncrementQuantity: z.number().optional(),
  recipeIngredients: z
    .union([z.array(RecipeIngredient_Input), z.null(), z.array(z.union([z.array(RecipeIngredient_Input), z.null()]))])
    .optional(),
});

export type ShoppingListAddRecipeParamsBulk = z.infer<typeof ShoppingListAddRecipeParamsBulk>;
export const ShoppingListAddRecipeParamsBulk = z.object({
  recipeIncrementQuantity: z.union([z.number(), z.undefined()]).optional(),
  recipeIngredients: z
    .union([
      z.array(RecipeIngredient_Input),
      z.null(),
      z.array(z.union([z.array(RecipeIngredient_Input), z.null()])),
      z.undefined(),
    ])
    .optional(),
  recipeId: z.string(),
});

export type ShoppingListCreate = z.infer<typeof ShoppingListCreate>;
export const ShoppingListCreate = z.object({
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
  update_at: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
});

export type ShoppingListItemRecipeRefCreate = z.infer<typeof ShoppingListItemRecipeRefCreate>;
export const ShoppingListItemRecipeRefCreate = z.object({
  recipeId: z.string(),
  recipeQuantity: z.union([z.number(), z.undefined()]).optional(),
  recipeScale: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()])), z.undefined()]).optional(),
  recipeNote: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type ShoppingListItemCreate = z.infer<typeof ShoppingListItemCreate>;
export const ShoppingListItemCreate = z.object({
  quantity: z.union([z.number(), z.undefined()]).optional(),
  unit: z
    .union([
      IngredientUnit_Input,
      CreateIngredientUnit,
      z.null(),
      z.array(z.union([IngredientUnit_Input, CreateIngredientUnit, z.null()])),
      z.undefined(),
    ])
    .optional(),
  food: z
    .union([
      IngredientFood_Input,
      CreateIngredientFood,
      z.null(),
      z.array(z.union([IngredientFood_Input, CreateIngredientFood, z.null()])),
      z.undefined(),
    ])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  isFood: z.union([z.boolean(), z.undefined()]).optional(),
  disableAmount: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()])), z.undefined()]).optional(),
  display: z.union([z.string(), z.undefined()]).optional(),
  shoppingListId: z.string(),
  checked: z.union([z.boolean(), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  foodId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  unitId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  recipeReferences: z.union([z.array(ShoppingListItemRecipeRefCreate), z.undefined()]).optional(),
});

export type ShoppingListItemRecipeRefOut = z.infer<typeof ShoppingListItemRecipeRefOut>;
export const ShoppingListItemRecipeRefOut = z.object({
  recipeId: z.string(),
  recipeQuantity: z.union([z.number(), z.undefined()]).optional(),
  recipeScale: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()])), z.undefined()]).optional(),
  recipeNote: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  id: z.string(),
  shoppingListItemId: z.string(),
});

export type ShoppingListItemOut_Input = z.infer<typeof ShoppingListItemOut_Input>;
export const ShoppingListItemOut_Input = z.object({
  quantity: z.union([z.number(), z.undefined()]).optional(),
  unit: z
    .union([IngredientUnit_Input, z.null(), z.array(z.union([IngredientUnit_Input, z.null()])), z.undefined()])
    .optional(),
  food: z
    .union([IngredientFood_Input, z.null(), z.array(z.union([IngredientFood_Input, z.null()])), z.undefined()])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  isFood: z.union([z.boolean(), z.undefined()]).optional(),
  disableAmount: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()])), z.undefined()]).optional(),
  display: z.union([z.string(), z.undefined()]).optional(),
  shoppingListId: z.string(),
  checked: z.union([z.boolean(), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  foodId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  unitId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  id: z.string(),
  groupId: z.string(),
  householdId: z.string(),
  label: z
    .union([MultiPurposeLabelSummary, z.null(), z.array(z.union([MultiPurposeLabelSummary, z.null()])), z.undefined()])
    .optional(),
  recipeReferences: z.union([z.array(ShoppingListItemRecipeRefOut), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  update_at: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type ShoppingListItemOut_Output = z.infer<typeof ShoppingListItemOut_Output>;
export const ShoppingListItemOut_Output = z.object({
  quantity: z.union([z.number(), z.undefined()]).optional(),
  unit: z
    .union([IngredientUnit_Output, z.null(), z.array(z.union([IngredientUnit_Output, z.null()])), z.undefined()])
    .optional(),
  food: z
    .union([IngredientFood_Output, z.null(), z.array(z.union([IngredientFood_Output, z.null()])), z.undefined()])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  isFood: z.union([z.boolean(), z.undefined()]).optional(),
  disableAmount: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()])), z.undefined()]).optional(),
  display: z.union([z.string(), z.undefined()]).optional(),
  shoppingListId: z.string(),
  checked: z.union([z.boolean(), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  foodId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  unitId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  id: z.string(),
  groupId: z.string(),
  householdId: z.string(),
  label: z
    .union([MultiPurposeLabelSummary, z.null(), z.array(z.union([MultiPurposeLabelSummary, z.null()])), z.undefined()])
    .optional(),
  recipeReferences: z.union([z.array(ShoppingListItemRecipeRefOut), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type ShoppingListItemPagination = z.infer<typeof ShoppingListItemPagination>;
export const ShoppingListItemPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(ShoppingListItemOut_Output),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type ShoppingListItemRecipeRefUpdate = z.infer<typeof ShoppingListItemRecipeRefUpdate>;
export const ShoppingListItemRecipeRefUpdate = z.object({
  recipeId: z.string(),
  recipeQuantity: z.union([z.number(), z.undefined()]).optional(),
  recipeScale: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()])), z.undefined()]).optional(),
  recipeNote: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  id: z.string(),
  shoppingListItemId: z.string(),
});

export type ShoppingListItemUpdate = z.infer<typeof ShoppingListItemUpdate>;
export const ShoppingListItemUpdate = z.object({
  quantity: z.union([z.number(), z.undefined()]).optional(),
  unit: z
    .union([
      IngredientUnit_Input,
      CreateIngredientUnit,
      z.null(),
      z.array(z.union([IngredientUnit_Input, CreateIngredientUnit, z.null()])),
      z.undefined(),
    ])
    .optional(),
  food: z
    .union([
      IngredientFood_Input,
      CreateIngredientFood,
      z.null(),
      z.array(z.union([IngredientFood_Input, CreateIngredientFood, z.null()])),
      z.undefined(),
    ])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  isFood: z.union([z.boolean(), z.undefined()]).optional(),
  disableAmount: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()])), z.undefined()]).optional(),
  display: z.union([z.string(), z.undefined()]).optional(),
  shoppingListId: z.string(),
  checked: z.union([z.boolean(), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  foodId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  unitId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  recipeReferences: z
    .union([
      z.array(
        z.union([
          ShoppingListItemRecipeRefCreate,
          ShoppingListItemRecipeRefUpdate,
          z.array(z.union([ShoppingListItemRecipeRefCreate, ShoppingListItemRecipeRefUpdate])),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
});

export type ShoppingListItemUpdateBulk = z.infer<typeof ShoppingListItemUpdateBulk>;
export const ShoppingListItemUpdateBulk = z.object({
  quantity: z.union([z.number(), z.undefined()]).optional(),
  unit: z
    .union([
      IngredientUnit_Input,
      CreateIngredientUnit,
      z.null(),
      z.array(z.union([IngredientUnit_Input, CreateIngredientUnit, z.null()])),
      z.undefined(),
    ])
    .optional(),
  food: z
    .union([
      IngredientFood_Input,
      CreateIngredientFood,
      z.null(),
      z.array(z.union([IngredientFood_Input, CreateIngredientFood, z.null()])),
      z.undefined(),
    ])
    .optional(),
  note: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  isFood: z.union([z.boolean(), z.undefined()]).optional(),
  disableAmount: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()])), z.undefined()]).optional(),
  display: z.union([z.string(), z.undefined()]).optional(),
  shoppingListId: z.string(),
  checked: z.union([z.boolean(), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  foodId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  labelId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  unitId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  recipeReferences: z
    .union([
      z.array(
        z.union([
          ShoppingListItemRecipeRefCreate,
          ShoppingListItemRecipeRefUpdate,
          z.array(z.union([ShoppingListItemRecipeRefCreate, ShoppingListItemRecipeRefUpdate])),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
});

export type ShoppingListItemsCollectionOut = z.infer<typeof ShoppingListItemsCollectionOut>;
export const ShoppingListItemsCollectionOut = z.object({
  createdItems: z.array(ShoppingListItemOut_Output).optional(),
  updatedItems: z.array(ShoppingListItemOut_Output).optional(),
  deletedItems: z.array(ShoppingListItemOut_Output).optional(),
});

export type ShoppingListMultiPurposeLabelOut = z.infer<typeof ShoppingListMultiPurposeLabelOut>;
export const ShoppingListMultiPurposeLabelOut = z.object({
  shoppingListId: z.string(),
  labelId: z.string(),
  position: z.union([z.number(), z.undefined()]).optional(),
  id: z.string(),
  label: MultiPurposeLabelSummary,
});

export type ShoppingListMultiPurposeLabelUpdate = z.infer<typeof ShoppingListMultiPurposeLabelUpdate>;
export const ShoppingListMultiPurposeLabelUpdate = z.object({
  shoppingListId: z.string(),
  labelId: z.string(),
  position: z.union([z.number(), z.undefined()]).optional(),
  id: z.string(),
});

export type ShoppingListRecipeRefOut = z.infer<typeof ShoppingListRecipeRefOut>;
export const ShoppingListRecipeRefOut = z.object({
  id: z.string(),
  shoppingListId: z.string(),
  recipeId: z.string(),
  recipeQuantity: z.number(),
  recipe: RecipeSummary,
});

export type ShoppingListOut = z.infer<typeof ShoppingListOut>;
export const ShoppingListOut = z.object({
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  groupId: z.string(),
  userId: z.string(),
  id: z.string(),
  listItems: z.union([z.array(ShoppingListItemOut_Output), z.undefined()]).optional(),
  householdId: z.string(),
  recipeReferences: z.union([z.array(ShoppingListRecipeRefOut), z.undefined()]).optional(),
  labelSettings: z.union([z.array(ShoppingListMultiPurposeLabelOut), z.undefined()]).optional(),
});

export type ShoppingListSummary = z.infer<typeof ShoppingListSummary>;
export const ShoppingListSummary = z.object({
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  updatedAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  groupId: z.string(),
  userId: z.string(),
  id: z.string(),
  householdId: z.string(),
  recipeReferences: z.array(ShoppingListRecipeRefOut),
  labelSettings: z.array(ShoppingListMultiPurposeLabelOut),
});

export type ShoppingListPagination = z.infer<typeof ShoppingListPagination>;
export const ShoppingListPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(ShoppingListSummary),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type ShoppingListRemoveRecipeParams = z.infer<typeof ShoppingListRemoveRecipeParams>;
export const ShoppingListRemoveRecipeParams = z.object({
  recipeDecrementQuantity: z.number().optional(),
});

export type ShoppingListUpdate = z.infer<typeof ShoppingListUpdate>;
export const ShoppingListUpdate = z.object({
  name: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  extras: z.union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()])), z.undefined()]).optional(),
  createdAt: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  update_at: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  groupId: z.string(),
  userId: z.string(),
  id: z.string(),
  listItems: z.union([z.array(ShoppingListItemOut_Input), z.undefined()]).optional(),
});

export type SuccessResponse = z.infer<typeof SuccessResponse>;
export const SuccessResponse = z.object({
  message: z.string(),
  error: z.union([z.boolean(), z.undefined()]).optional(),
});

export type TagIn = z.infer<typeof TagIn>;
export const TagIn = z.object({
  name: z.string(),
});

export type TagOut = z.infer<typeof TagOut>;
export const TagOut = z.object({
  name: z.string(),
  groupId: z.string(),
  id: z.string(),
  slug: z.string(),
});

export type UnlockResults = z.infer<typeof UnlockResults>;
export const UnlockResults = z.object({
  unlocked: z.number().optional(),
});

export type UpdateCookBook = z.infer<typeof UpdateCookBook>;
export const UpdateCookBook = z.object({
  name: z.string(),
  description: z.union([z.string(), z.undefined()]).optional(),
  slug: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  position: z.union([z.number(), z.undefined()]).optional(),
  public: z.union([z.boolean(), z.undefined()]).optional(),
  queryFilterString: z.union([z.string(), z.undefined()]).optional(),
  groupId: z.string(),
  householdId: z.string(),
  id: z.string(),
});

export type UpdateHouseholdPreferences = z.infer<typeof UpdateHouseholdPreferences>;
export const UpdateHouseholdPreferences = z.object({
  privateHousehold: z.boolean().optional(),
  lockRecipeEditsFromOtherHouseholds: z.boolean().optional(),
  firstDayOfWeek: z.number().optional(),
  recipePublic: z.boolean().optional(),
  recipeShowNutrition: z.boolean().optional(),
  recipeShowAssets: z.boolean().optional(),
  recipeLandscapeView: z.boolean().optional(),
  recipeDisableComments: z.boolean().optional(),
  recipeDisableAmount: z.boolean().optional(),
});

export type UpdateHouseholdAdmin = z.infer<typeof UpdateHouseholdAdmin>;
export const UpdateHouseholdAdmin = z.object({
  groupId: z.string(),
  name: z.string(),
  id: z.string(),
  preferences: z
    .union([
      UpdateHouseholdPreferences,
      z.null(),
      z.array(z.union([UpdateHouseholdPreferences, z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type UpdateImageResponse = z.infer<typeof UpdateImageResponse>;
export const UpdateImageResponse = z.object({
  image: z.string(),
});

export type UpdatePlanEntry = z.infer<typeof UpdatePlanEntry>;
export const UpdatePlanEntry = z.object({
  date: z.string(),
  entryType: z.union([PlanEntryType, z.undefined()]).optional(),
  title: z.union([z.string(), z.undefined()]).optional(),
  text: z.union([z.string(), z.undefined()]).optional(),
  recipeId: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  id: z.number(),
  groupId: z.string(),
  userId: z.string(),
});

export type UserIn = z.infer<typeof UserIn>;
export const UserIn = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  authMethod: z.union([AuthMethod, z.undefined()]).optional(),
  admin: z.union([z.boolean(), z.undefined()]).optional(),
  group: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  household: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  advanced: z.union([z.boolean(), z.undefined()]).optional(),
  canInvite: z.union([z.boolean(), z.undefined()]).optional(),
  canManage: z.union([z.boolean(), z.undefined()]).optional(),
  canManageHousehold: z.union([z.boolean(), z.undefined()]).optional(),
  canOrganize: z.union([z.boolean(), z.undefined()]).optional(),
  password: z.string(),
});

export type UserPagination = z.infer<typeof UserPagination>;
export const UserPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(UserOut),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type UserRatingOut = z.infer<typeof UserRatingOut>;
export const UserRatingOut = z.object({
  recipeId: z.string(),
  rating: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()])), z.undefined()]).optional(),
  isFavorite: z.union([z.boolean(), z.undefined()]).optional(),
  userId: z.string(),
  id: z.string(),
});

export type UserRatingSummary = z.infer<typeof UserRatingSummary>;
export const UserRatingSummary = z.object({
  recipeId: z.string(),
  rating: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()])), z.undefined()]).optional(),
  isFavorite: z.union([z.boolean(), z.undefined()]).optional(),
});

export type UserRatingUpdate = z.infer<typeof UserRatingUpdate>;
export const UserRatingUpdate = z.object({
  rating: z.union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))]).optional(),
  isFavorite: z.union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))]).optional(),
});

export type UserRatings_UserRatingOut_ = z.infer<typeof UserRatings_UserRatingOut_>;
export const UserRatings_UserRatingOut_ = z.object({
  ratings: z.array(UserRatingOut),
});

export type UserRatings_UserRatingSummary_ = z.infer<typeof UserRatings_UserRatingSummary_>;
export const UserRatings_UserRatingSummary_ = z.object({
  ratings: z.array(UserRatingSummary),
});

export type WebhookPagination = z.infer<typeof WebhookPagination>;
export const WebhookPagination = z.object({
  page: z.union([z.number(), z.undefined()]).optional(),
  per_page: z.union([z.number(), z.undefined()]).optional(),
  total: z.union([z.number(), z.undefined()]).optional(),
  total_pages: z.union([z.number(), z.undefined()]).optional(),
  items: z.array(ReadWebhook),
  next: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  previous: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
});

export type mealie__schema__user__user__UserBase = z.infer<typeof mealie__schema__user__user__UserBase>;
export const mealie__schema__user__user__UserBase = z.object({
  id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  username: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  fullName: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  email: z.string(),
  authMethod: z.union([AuthMethod, z.undefined()]).optional(),
  admin: z.union([z.boolean(), z.undefined()]).optional(),
  group: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  household: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()])), z.undefined()]).optional(),
  advanced: z.union([z.boolean(), z.undefined()]).optional(),
  canInvite: z.union([z.boolean(), z.undefined()]).optional(),
  canManage: z.union([z.boolean(), z.undefined()]).optional(),
  canManageHousehold: z.union([z.boolean(), z.undefined()]).optional(),
  canOrganize: z.union([z.boolean(), z.undefined()]).optional(),
});

export type get_Get_app_info_api_app_about_get = typeof get_Get_app_info_api_app_about_get;
export const get_Get_app_info_api_app_about_get = {
  method: z.literal("GET"),
  path: z.literal("/api/app/about"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: AppInfo,
};

export type get_Get_startup_info_api_app_about_startup_info_get =
  typeof get_Get_startup_info_api_app_about_startup_info_get;
export const get_Get_startup_info_api_app_about_startup_info_get = {
  method: z.literal("GET"),
  path: z.literal("/api/app/about/startup-info"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: AppStartupInfo,
};

export type get_Get_app_theme_api_app_about_theme_get = typeof get_Get_app_theme_api_app_about_theme_get;
export const get_Get_app_theme_api_app_about_theme_get = {
  method: z.literal("GET"),
  path: z.literal("/api/app/about/theme"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: AppTheme,
};

export type post_Get_token_api_auth_token_post = typeof post_Get_token_api_auth_token_post;
export const post_Get_token_api_auth_token_post = {
  method: z.literal("POST"),
  path: z.literal("/api/auth/token"),
  requestFormat: z.literal("form-url"),
  parameters: z.object({
    body: Body_get_token_api_auth_token_post,
  }),
  response: z.unknown(),
};

export type get_Oauth_login_api_auth_oauth_get = typeof get_Oauth_login_api_auth_oauth_get;
export const get_Oauth_login_api_auth_oauth_get = {
  method: z.literal("GET"),
  path: z.literal("/api/auth/oauth"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_Oauth_callback_api_auth_oauth_callback_get = typeof get_Oauth_callback_api_auth_oauth_callback_get;
export const get_Oauth_callback_api_auth_oauth_callback_get = {
  method: z.literal("GET"),
  path: z.literal("/api/auth/oauth/callback"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_Refresh_token_api_auth_refresh_get = typeof get_Refresh_token_api_auth_refresh_get;
export const get_Refresh_token_api_auth_refresh_get = {
  method: z.literal("GET"),
  path: z.literal("/api/auth/refresh"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type post_Logout_api_auth_logout_post = typeof post_Logout_api_auth_logout_post;
export const post_Logout_api_auth_logout_post = {
  method: z.literal("POST"),
  path: z.literal("/api/auth/logout"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type post_Register_new_user_api_users_register_post = typeof post_Register_new_user_api_users_register_post;
export const post_Register_new_user_api_users_register_post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/register"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateUserRegistration,
  }),
  response: UserOut,
};

export type get_Get_logged_in_user_api_users_self_get = typeof get_Get_logged_in_user_api_users_self_get;
export const get_Get_logged_in_user_api_users_self_get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/self"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserOut,
};

export type get_Get_logged_in_user_ratings_api_users_self_ratings_get =
  typeof get_Get_logged_in_user_ratings_api_users_self_ratings_get;
export const get_Get_logged_in_user_ratings_api_users_self_ratings_get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/self/ratings"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserRatings_UserRatingSummary_,
};

export type get_Get_logged_in_user_rating_for_recipe_api_users_self_ratings__recipe_id__get =
  typeof get_Get_logged_in_user_rating_for_recipe_api_users_self_ratings__recipe_id__get;
export const get_Get_logged_in_user_rating_for_recipe_api_users_self_ratings__recipe_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/self/ratings/{recipe_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipe_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserRatingSummary,
};

export type get_Get_logged_in_user_favorites_api_users_self_favorites_get =
  typeof get_Get_logged_in_user_favorites_api_users_self_favorites_get;
export const get_Get_logged_in_user_favorites_api_users_self_favorites_get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/self/favorites"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserRatings_UserRatingSummary_,
};

export type put_Update_password_api_users_password_put = typeof put_Update_password_api_users_password_put;
export const put_Update_password_api_users_password_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/users/password"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ChangePassword,
  }),
  response: z.unknown(),
};

export type put_Update_user_api_users__item_id__put = typeof put_Update_user_api_users__item_id__put;
export const put_Update_user_api_users__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/users/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: mealie__schema__user__user__UserBase,
  }),
  response: z.unknown(),
};

export type get_Get_user_api_users__item_id__get = typeof get_Get_user_api_users__item_id__get;
export const get_Get_user_api_users__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserOut,
};

export type delete_Delete_user_api_users__item_id__delete = typeof delete_Delete_user_api_users__item_id__delete;
export const delete_Delete_user_api_users__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/users/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_users_get = typeof get_Get_all_api_users_get;
export const get_Get_all_api_users_get = {
  method: z.literal("GET"),
  path: z.literal("/api/users"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserPagination,
};

export type post_Create_user_api_users_post = typeof post_Create_user_api_users_post;
export const post_Create_user_api_users_post = {
  method: z.literal("POST"),
  path: z.literal("/api/users"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UserIn,
  }),
  response: UserOut,
};

export type post_Forgot_password_api_users_forgot_password_post =
  typeof post_Forgot_password_api_users_forgot_password_post;
export const post_Forgot_password_api_users_forgot_password_post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/forgot-password"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ForgotPassword,
  }),
  response: z.unknown(),
};

export type post_Reset_password_api_users_reset_password_post =
  typeof post_Reset_password_api_users_reset_password_post;
export const post_Reset_password_api_users_reset_password_post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/reset-password"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    body: ResetPassword,
  }),
  response: z.unknown(),
};

export type post_Update_user_image_api_users__id__image_post = typeof post_Update_user_image_api_users__id__image_post;
export const post_Update_user_image_api_users__id__image_post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/{id}/image"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    path: z.object({
      id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_update_user_image_api_users__id__image_post,
  }),
  response: z.unknown(),
};

export type post_Create_api_token_api_users_api_tokens_post = typeof post_Create_api_token_api_users_api_tokens_post;
export const post_Create_api_token_api_users_api_tokens_post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/api-tokens"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: LongLiveTokenIn,
  }),
  response: LongLiveTokenCreateResponse,
};

export type delete_Delete_api_token_api_users_api_tokens__token_id__delete =
  typeof delete_Delete_api_token_api_users_api_tokens__token_id__delete;
export const delete_Delete_api_token_api_users_api_tokens__token_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/users/api-tokens/{token_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      token_id: z.number(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: DeleteTokenResponse,
};

export type get_Get_ratings_api_users__id__ratings_get = typeof get_Get_ratings_api_users__id__ratings_get;
export const get_Get_ratings_api_users__id__ratings_get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/{id}/ratings"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserRatings_UserRatingOut_,
};

export type get_Get_favorites_api_users__id__favorites_get = typeof get_Get_favorites_api_users__id__favorites_get;
export const get_Get_favorites_api_users__id__favorites_get = {
  method: z.literal("GET"),
  path: z.literal("/api/users/{id}/favorites"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserRatings_UserRatingOut_,
};

export type post_Set_rating_api_users__id__ratings__slug__post =
  typeof post_Set_rating_api_users__id__ratings__slug__post;
export const post_Set_rating_api_users__id__ratings__slug__post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/{id}/ratings/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      id: z.string(),
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UserRatingUpdate,
  }),
  response: z.unknown(),
};

export type post_Add_favorite_api_users__id__favorites__slug__post =
  typeof post_Add_favorite_api_users__id__favorites__slug__post;
export const post_Add_favorite_api_users__id__favorites__slug__post = {
  method: z.literal("POST"),
  path: z.literal("/api/users/{id}/favorites/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      id: z.string(),
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type delete_Remove_favorite_api_users__id__favorites__slug__delete =
  typeof delete_Remove_favorite_api_users__id__favorites__slug__delete;
export const delete_Remove_favorite_api_users__id__favorites__slug__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/users/{id}/favorites/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      id: z.string(),
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_households_cookbooks_get = typeof get_Get_all_api_households_cookbooks_get;
export const get_Get_all_api_households_cookbooks_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/cookbooks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: CookBookPagination,
};

export type post_Create_one_api_households_cookbooks_post = typeof post_Create_one_api_households_cookbooks_post;
export const post_Create_one_api_households_cookbooks_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/cookbooks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateCookBook,
  }),
  response: ReadCookBook,
};

export type put_Update_many_api_households_cookbooks_put = typeof put_Update_many_api_households_cookbooks_put;
export const put_Update_many_api_households_cookbooks_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/cookbooks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(UpdateCookBook),
  }),
  response: z.array(ReadCookBook),
};

export type get_Get_one_api_households_cookbooks__item_id__get =
  typeof get_Get_one_api_households_cookbooks__item_id__get;
export const get_Get_one_api_households_cookbooks__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/cookbooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))]),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeCookBook,
};

export type put_Update_one_api_households_cookbooks__item_id__put =
  typeof put_Update_one_api_households_cookbooks__item_id__put;
export const put_Update_one_api_households_cookbooks__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/cookbooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateCookBook,
  }),
  response: ReadCookBook,
};

export type delete_Delete_one_api_households_cookbooks__item_id__delete =
  typeof delete_Delete_one_api_households_cookbooks__item_id__delete;
export const delete_Delete_one_api_households_cookbooks__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/cookbooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadCookBook,
};

export type get_Get_all_api_households_events_notifications_get =
  typeof get_Get_all_api_households_events_notifications_get;
export const get_Get_all_api_households_events_notifications_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/events/notifications"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupEventPagination,
};

export type post_Create_one_api_households_events_notifications_post =
  typeof post_Create_one_api_households_events_notifications_post;
export const post_Create_one_api_households_events_notifications_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/events/notifications"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: GroupEventNotifierCreate,
  }),
  response: GroupEventNotifierOut,
};

export type get_Get_one_api_households_events_notifications__item_id__get =
  typeof get_Get_one_api_households_events_notifications__item_id__get;
export const get_Get_one_api_households_events_notifications__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/events/notifications/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupEventNotifierOut,
};

export type put_Update_one_api_households_events_notifications__item_id__put =
  typeof put_Update_one_api_households_events_notifications__item_id__put;
export const put_Update_one_api_households_events_notifications__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/events/notifications/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: GroupEventNotifierUpdate,
  }),
  response: GroupEventNotifierOut,
};

export type delete_Delete_one_api_households_events_notifications__item_id__delete =
  typeof delete_Delete_one_api_households_events_notifications__item_id__delete;
export const delete_Delete_one_api_households_events_notifications__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/events/notifications/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Test_notification_api_households_events_notifications__item_id__test_post =
  typeof post_Test_notification_api_households_events_notifications__item_id__test_post;
export const post_Test_notification_api_households_events_notifications__item_id__test_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/events/notifications/{item_id}/test"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_households_recipe_actions_get = typeof get_Get_all_api_households_recipe_actions_get;
export const get_Get_all_api_households_recipe_actions_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/recipe-actions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupRecipeActionPagination,
};

export type post_Create_one_api_households_recipe_actions_post =
  typeof post_Create_one_api_households_recipe_actions_post;
export const post_Create_one_api_households_recipe_actions_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/recipe-actions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateGroupRecipeAction,
  }),
  response: GroupRecipeActionOut,
};

export type get_Get_one_api_households_recipe_actions__item_id__get =
  typeof get_Get_one_api_households_recipe_actions__item_id__get;
export const get_Get_one_api_households_recipe_actions__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/recipe-actions/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupRecipeActionOut,
};

export type put_Update_one_api_households_recipe_actions__item_id__put =
  typeof put_Update_one_api_households_recipe_actions__item_id__put;
export const put_Update_one_api_households_recipe_actions__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/recipe-actions/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: SaveGroupRecipeAction,
  }),
  response: GroupRecipeActionOut,
};

export type delete_Delete_one_api_households_recipe_actions__item_id__delete =
  typeof delete_Delete_one_api_households_recipe_actions__item_id__delete;
export const delete_Delete_one_api_households_recipe_actions__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/recipe-actions/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupRecipeActionOut,
};

export type post_Trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post =
  typeof post_Trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post;
export const post_Trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/recipe-actions/{item_id}/trigger/{recipe_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
      recipe_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_logged_in_user_household_api_households_self_get =
  typeof get_Get_logged_in_user_household_api_households_self_get;
export const get_Get_logged_in_user_household_api_households_self_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/self"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdInDB,
};

export type get_Get_household_recipe_api_households_self_recipes__recipe_slug__get =
  typeof get_Get_household_recipe_api_households_self_recipes__recipe_slug__get;
export const get_Get_household_recipe_api_households_self_recipes__recipe_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/self/recipes/{recipe_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipe_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdRecipeSummary,
};

export type get_Get_household_members_api_households_members_get =
  typeof get_Get_household_members_api_households_members_get;
export const get_Get_household_members_api_households_members_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/members"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_UserOut_,
};

export type get_Get_household_preferences_api_households_preferences_get =
  typeof get_Get_household_preferences_api_households_preferences_get;
export const get_Get_household_preferences_api_households_preferences_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/preferences"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadHouseholdPreferences,
};

export type put_Update_household_preferences_api_households_preferences_put =
  typeof put_Update_household_preferences_api_households_preferences_put;
export const put_Update_household_preferences_api_households_preferences_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/preferences"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UpdateHouseholdPreferences,
  }),
  response: ReadHouseholdPreferences,
};

export type put_Set_member_permissions_api_households_permissions_put =
  typeof put_Set_member_permissions_api_households_permissions_put;
export const put_Set_member_permissions_api_households_permissions_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/permissions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: SetPermissions,
  }),
  response: UserOut,
};

export type get_Get_statistics_api_households_statistics_get = typeof get_Get_statistics_api_households_statistics_get;
export const get_Get_statistics_api_households_statistics_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/statistics"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdStatistics,
};

export type get_Get_invite_tokens_api_households_invitations_get =
  typeof get_Get_invite_tokens_api_households_invitations_get;
export const get_Get_invite_tokens_api_households_invitations_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/invitations"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.array(ReadInviteToken),
};

export type post_Create_invite_token_api_households_invitations_post =
  typeof post_Create_invite_token_api_households_invitations_post;
export const post_Create_invite_token_api_households_invitations_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/invitations"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateInviteToken,
  }),
  response: ReadInviteToken,
};

export type post_Email_invitation_api_households_invitations_email_post =
  typeof post_Email_invitation_api_households_invitations_email_post;
export const post_Email_invitation_api_households_invitations_email_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/invitations/email"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: EmailInvitation,
  }),
  response: EmailInitationResponse,
};

export type get_Get_all_api_households_shopping_lists_get = typeof get_Get_all_api_households_shopping_lists_get;
export const get_Get_all_api_households_shopping_lists_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/shopping/lists"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ShoppingListPagination,
};

export type post_Create_one_api_households_shopping_lists_post =
  typeof post_Create_one_api_households_shopping_lists_post;
export const post_Create_one_api_households_shopping_lists_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/shopping/lists"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ShoppingListCreate,
  }),
  response: ShoppingListOut,
};

export type get_Get_one_api_households_shopping_lists__item_id__get =
  typeof get_Get_one_api_households_shopping_lists__item_id__get;
export const get_Get_one_api_households_shopping_lists__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/shopping/lists/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ShoppingListOut,
};

export type put_Update_one_api_households_shopping_lists__item_id__put =
  typeof put_Update_one_api_households_shopping_lists__item_id__put;
export const put_Update_one_api_households_shopping_lists__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/shopping/lists/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ShoppingListUpdate,
  }),
  response: ShoppingListOut,
};

export type delete_Delete_one_api_households_shopping_lists__item_id__delete =
  typeof delete_Delete_one_api_households_shopping_lists__item_id__delete;
export const delete_Delete_one_api_households_shopping_lists__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/shopping/lists/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ShoppingListOut,
};

export type put_Update_label_settings_api_households_shopping_lists__item_id__label_settings_put =
  typeof put_Update_label_settings_api_households_shopping_lists__item_id__label_settings_put;
export const put_Update_label_settings_api_households_shopping_lists__item_id__label_settings_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/shopping/lists/{item_id}/label-settings"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(ShoppingListMultiPurposeLabelUpdate),
  }),
  response: ShoppingListOut,
};

export type post_Add_recipe_ingredients_to_list_api_households_shopping_lists__item_id__recipe_post =
  typeof post_Add_recipe_ingredients_to_list_api_households_shopping_lists__item_id__recipe_post;
export const post_Add_recipe_ingredients_to_list_api_households_shopping_lists__item_id__recipe_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/shopping/lists/{item_id}/recipe"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(ShoppingListAddRecipeParamsBulk),
  }),
  response: ShoppingListOut,
};

export type post_Remove_recipe_ingredients_from_list_api_households_shopping_lists__item_id__recipe__recipe_id__delete_post =
  typeof post_Remove_recipe_ingredients_from_list_api_households_shopping_lists__item_id__recipe__recipe_id__delete_post;
export const post_Remove_recipe_ingredients_from_list_api_households_shopping_lists__item_id__recipe__recipe_id__delete_post =
  {
    method: z.literal("POST"),
    path: z.literal("/api/households/shopping/lists/{item_id}/recipe/{recipe_id}/delete"),
    requestFormat: z.literal("json"),
    parameters: z.object({
      path: z.object({
        item_id: z.string(),
        recipe_id: z.string(),
      }),
      header: z.object({
        "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      }),
      body: z.union([
        ShoppingListRemoveRecipeParams,
        z.null(),
        z.array(z.union([ShoppingListRemoveRecipeParams, z.null()])),
      ]),
    }),
    response: ShoppingListOut,
  };

export type get_Get_all_api_households_shopping_items_get = typeof get_Get_all_api_households_shopping_items_get;
export const get_Get_all_api_households_shopping_items_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/shopping/items"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ShoppingListItemPagination,
};

export type post_Create_one_api_households_shopping_items_post =
  typeof post_Create_one_api_households_shopping_items_post;
export const post_Create_one_api_households_shopping_items_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/shopping/items"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ShoppingListItemCreate,
  }),
  response: ShoppingListItemsCollectionOut,
};

export type put_Update_many_api_households_shopping_items_put =
  typeof put_Update_many_api_households_shopping_items_put;
export const put_Update_many_api_households_shopping_items_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/shopping/items"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(ShoppingListItemUpdateBulk),
  }),
  response: ShoppingListItemsCollectionOut,
};

export type delete_Delete_many_api_households_shopping_items_delete =
  typeof delete_Delete_many_api_households_shopping_items_delete;
export const delete_Delete_many_api_households_shopping_items_delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/shopping/items"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      ids: z.array(z.string()).optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type post_Create_many_api_households_shopping_items_create_bulk_post =
  typeof post_Create_many_api_households_shopping_items_create_bulk_post;
export const post_Create_many_api_households_shopping_items_create_bulk_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/shopping/items/create-bulk"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(ShoppingListItemCreate),
  }),
  response: ShoppingListItemsCollectionOut,
};

export type get_Get_one_api_households_shopping_items__item_id__get =
  typeof get_Get_one_api_households_shopping_items__item_id__get;
export const get_Get_one_api_households_shopping_items__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/shopping/items/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ShoppingListItemOut_Output,
};

export type put_Update_one_api_households_shopping_items__item_id__put =
  typeof put_Update_one_api_households_shopping_items__item_id__put;
export const put_Update_one_api_households_shopping_items__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/shopping/items/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ShoppingListItemUpdate,
  }),
  response: ShoppingListItemsCollectionOut,
};

export type delete_Delete_one_api_households_shopping_items__item_id__delete =
  typeof delete_Delete_one_api_households_shopping_items__item_id__delete;
export const delete_Delete_one_api_households_shopping_items__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/shopping/items/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type get_Get_all_api_households_webhooks_get = typeof get_Get_all_api_households_webhooks_get;
export const get_Get_all_api_households_webhooks_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/webhooks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: WebhookPagination,
};

export type post_Create_one_api_households_webhooks_post = typeof post_Create_one_api_households_webhooks_post;
export const post_Create_one_api_households_webhooks_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/webhooks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateWebhook,
  }),
  response: ReadWebhook,
};

export type post_Rerun_webhooks_api_households_webhooks_rerun_post =
  typeof post_Rerun_webhooks_api_households_webhooks_rerun_post;
export const post_Rerun_webhooks_api_households_webhooks_rerun_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/webhooks/rerun"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_one_api_households_webhooks__item_id__get =
  typeof get_Get_one_api_households_webhooks__item_id__get;
export const get_Get_one_api_households_webhooks__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/webhooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadWebhook,
};

export type put_Update_one_api_households_webhooks__item_id__put =
  typeof put_Update_one_api_households_webhooks__item_id__put;
export const put_Update_one_api_households_webhooks__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/webhooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateWebhook,
  }),
  response: ReadWebhook,
};

export type delete_Delete_one_api_households_webhooks__item_id__delete =
  typeof delete_Delete_one_api_households_webhooks__item_id__delete;
export const delete_Delete_one_api_households_webhooks__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/webhooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadWebhook,
};

export type post_Test_one_api_households_webhooks__item_id__test_post =
  typeof post_Test_one_api_households_webhooks__item_id__test_post;
export const post_Test_one_api_households_webhooks__item_id__test_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/webhooks/{item_id}/test"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_households_mealplans_rules_get = typeof get_Get_all_api_households_mealplans_rules_get;
export const get_Get_all_api_households_mealplans_rules_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/mealplans/rules"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PlanRulesPagination,
};

export type post_Create_one_api_households_mealplans_rules_post =
  typeof post_Create_one_api_households_mealplans_rules_post;
export const post_Create_one_api_households_mealplans_rules_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/mealplans/rules"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: PlanRulesCreate,
  }),
  response: PlanRulesOut,
};

export type get_Get_one_api_households_mealplans_rules__item_id__get =
  typeof get_Get_one_api_households_mealplans_rules__item_id__get;
export const get_Get_one_api_households_mealplans_rules__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/mealplans/rules/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PlanRulesOut,
};

export type put_Update_one_api_households_mealplans_rules__item_id__put =
  typeof put_Update_one_api_households_mealplans_rules__item_id__put;
export const put_Update_one_api_households_mealplans_rules__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/mealplans/rules/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: PlanRulesCreate,
  }),
  response: PlanRulesOut,
};

export type delete_Delete_one_api_households_mealplans_rules__item_id__delete =
  typeof delete_Delete_one_api_households_mealplans_rules__item_id__delete;
export const delete_Delete_one_api_households_mealplans_rules__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/mealplans/rules/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PlanRulesOut,
};

export type get_Get_all_api_households_mealplans_get = typeof get_Get_all_api_households_mealplans_get;
export const get_Get_all_api_households_mealplans_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/mealplans"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      start_date: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      end_date: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PlanEntryPagination,
};

export type post_Create_one_api_households_mealplans_post = typeof post_Create_one_api_households_mealplans_post;
export const post_Create_one_api_households_mealplans_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/mealplans"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreatePlanEntry,
  }),
  response: ReadPlanEntry,
};

export type get_Get_todays_meals_api_households_mealplans_today_get =
  typeof get_Get_todays_meals_api_households_mealplans_today_get;
export const get_Get_todays_meals_api_households_mealplans_today_get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/mealplans/today"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Create_random_meal_api_households_mealplans_random_post =
  typeof post_Create_random_meal_api_households_mealplans_random_post;
export const post_Create_random_meal_api_households_mealplans_random_post = {
  method: z.literal("POST"),
  path: z.literal("/api/households/mealplans/random"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateRandomEntry,
  }),
  response: ReadPlanEntry,
};

export type get_Get_one_api_households_mealplans__item_id__get =
  typeof get_Get_one_api_households_mealplans__item_id__get;
export const get_Get_one_api_households_mealplans__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/households/mealplans/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.number(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadPlanEntry,
};

export type put_Update_one_api_households_mealplans__item_id__put =
  typeof put_Update_one_api_households_mealplans__item_id__put;
export const put_Update_one_api_households_mealplans__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/households/mealplans/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.number(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UpdatePlanEntry,
  }),
  response: ReadPlanEntry,
};

export type delete_Delete_one_api_households_mealplans__item_id__delete =
  typeof delete_Delete_one_api_households_mealplans__item_id__delete;
export const delete_Delete_one_api_households_mealplans__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/households/mealplans/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.number(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadPlanEntry,
};

export type get_Get_all_households_api_groups_households_get = typeof get_Get_all_households_api_groups_households_get;
export const get_Get_all_households_api_groups_households_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/households"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_HouseholdSummary_,
};

export type get_Get_one_household_api_groups_households__household_slug__get =
  typeof get_Get_one_household_api_groups_households__household_slug__get;
export const get_Get_one_household_api_groups_households__household_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/households/{household_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      household_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdSummary,
};

export type get_Get_logged_in_user_group_api_groups_self_get = typeof get_Get_logged_in_user_group_api_groups_self_get;
export const get_Get_logged_in_user_group_api_groups_self_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/self"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupSummary,
};

export type get_Get_group_members_api_groups_members_get = typeof get_Get_group_members_api_groups_members_get;
export const get_Get_group_members_api_groups_members_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/members"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_UserSummary_,
};

export type get_Get_group_member_api_groups_members__username_or_id__get =
  typeof get_Get_group_member_api_groups_members__username_or_id__get;
export const get_Get_group_member_api_groups_members__username_or_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/members/{username_or_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      username_or_id: z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))]),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserSummary,
};

export type get_Get_group_preferences_api_groups_preferences_get =
  typeof get_Get_group_preferences_api_groups_preferences_get;
export const get_Get_group_preferences_api_groups_preferences_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/preferences"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReadGroupPreferences,
};

export type put_Update_group_preferences_api_groups_preferences_put =
  typeof put_Update_group_preferences_api_groups_preferences_put;
export const put_Update_group_preferences_api_groups_preferences_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/groups/preferences"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UpdateGroupPreferences,
  }),
  response: ReadGroupPreferences,
};

export type get_Get_storage_api_groups_storage_get = typeof get_Get_storage_api_groups_storage_get;
export const get_Get_storage_api_groups_storage_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/storage"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupStorage,
};

export type post_Start_data_migration_api_groups_migrations_post =
  typeof post_Start_data_migration_api_groups_migrations_post;
export const post_Start_data_migration_api_groups_migrations_post = {
  method: z.literal("POST"),
  path: z.literal("/api/groups/migrations"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_start_data_migration_api_groups_migrations_post,
  }),
  response: ReportSummary,
};

export type get_Get_all_api_groups_reports_get = typeof get_Get_all_api_groups_reports_get;
export const get_Get_all_api_groups_reports_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/reports"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      report_type: z.union([ReportCategory, z.null(), z.array(z.union([ReportCategory, z.null()]))]).optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.array(ReportSummary),
};

export type get_Get_one_api_groups_reports__item_id__get = typeof get_Get_one_api_groups_reports__item_id__get;
export const get_Get_one_api_groups_reports__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/reports/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: ReportOut,
};

export type delete_Delete_one_api_groups_reports__item_id__delete =
  typeof delete_Delete_one_api_groups_reports__item_id__delete;
export const delete_Delete_one_api_groups_reports__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/groups/reports/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_groups_labels_get = typeof get_Get_all_api_groups_labels_get;
export const get_Get_all_api_groups_labels_get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/labels"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: MultiPurposeLabelPagination,
};

export type post_Create_one_api_groups_labels_post = typeof post_Create_one_api_groups_labels_post;
export const post_Create_one_api_groups_labels_post = {
  method: z.literal("POST"),
  path: z.literal("/api/groups/labels"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: MultiPurposeLabelCreate,
  }),
  response: MultiPurposeLabelOut,
};

export type get_Get_one_api_groups_labels__item_id__get = typeof get_Get_one_api_groups_labels__item_id__get;
export const get_Get_one_api_groups_labels__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/groups/labels/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: MultiPurposeLabelOut,
};

export type put_Update_one_api_groups_labels__item_id__put = typeof put_Update_one_api_groups_labels__item_id__put;
export const put_Update_one_api_groups_labels__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/groups/labels/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: MultiPurposeLabelUpdate,
  }),
  response: MultiPurposeLabelOut,
};

export type delete_Delete_one_api_groups_labels__item_id__delete =
  typeof delete_Delete_one_api_groups_labels__item_id__delete;
export const delete_Delete_one_api_groups_labels__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/groups/labels/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: MultiPurposeLabelOut,
};

export type post_Seed_foods_api_groups_seeders_foods_post = typeof post_Seed_foods_api_groups_seeders_foods_post;
export const post_Seed_foods_api_groups_seeders_foods_post = {
  method: z.literal("POST"),
  path: z.literal("/api/groups/seeders/foods"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: SeederConfig,
  }),
  response: SuccessResponse,
};

export type post_Seed_labels_api_groups_seeders_labels_post = typeof post_Seed_labels_api_groups_seeders_labels_post;
export const post_Seed_labels_api_groups_seeders_labels_post = {
  method: z.literal("POST"),
  path: z.literal("/api/groups/seeders/labels"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: SeederConfig,
  }),
  response: SuccessResponse,
};

export type post_Seed_units_api_groups_seeders_units_post = typeof post_Seed_units_api_groups_seeders_units_post;
export const post_Seed_units_api_groups_seeders_units_post = {
  method: z.literal("POST"),
  path: z.literal("/api/groups/seeders/units"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: SeederConfig,
  }),
  response: SuccessResponse,
};

export type get_Get_recipe_formats_and_templates_api_recipes_exports_get =
  typeof get_Get_recipe_formats_and_templates_api_recipes_exports_get;
export const get_Get_recipe_formats_and_templates_api_recipes_exports_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/exports"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: FormatResponse,
};

export type post_Get_recipe_zip_token_api_recipes__slug__exports_post =
  typeof post_Get_recipe_zip_token_api_recipes__slug__exports_post;
export const post_Get_recipe_zip_token_api_recipes__slug__exports_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/{slug}/exports"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeZipTokenResponse,
};

export type get_Get_recipe_as_format_api_recipes__slug__exports_get =
  typeof get_Get_recipe_as_format_api_recipes__slug__exports_get;
export const get_Get_recipe_as_format_api_recipes__slug__exports_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/{slug}/exports"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      template_name: z.string(),
    }),
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_recipe_as_zip_api_recipes__slug__exports_zip_get =
  typeof get_Get_recipe_as_zip_api_recipes__slug__exports_zip_get;
export const get_Get_recipe_as_zip_api_recipes__slug__exports_zip_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/{slug}/exports/zip"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      token: z.string(),
    }),
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Test_parse_recipe_url_api_recipes_test_scrape_url_post =
  typeof post_Test_parse_recipe_url_api_recipes_test_scrape_url_post;
export const post_Test_parse_recipe_url_api_recipes_test_scrape_url_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/test-scrape-url"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ScrapeRecipeTest,
  }),
  response: z.unknown(),
};

export type post_Create_recipe_from_html_or_json_api_recipes_create_html_or_json_post =
  typeof post_Create_recipe_from_html_or_json_api_recipes_create_html_or_json_post;
export const post_Create_recipe_from_html_or_json_api_recipes_create_html_or_json_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/create/html-or-json"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ScrapeRecipeData,
  }),
  response: z.unknown(),
};

export type post_Parse_recipe_url_api_recipes_create_url_post =
  typeof post_Parse_recipe_url_api_recipes_create_url_post;
export const post_Parse_recipe_url_api_recipes_create_url_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/create/url"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ScrapeRecipe,
  }),
  response: z.string(),
};

export type post_Parse_recipe_url_bulk_api_recipes_create_url_bulk_post =
  typeof post_Parse_recipe_url_bulk_api_recipes_create_url_bulk_post;
export const post_Parse_recipe_url_bulk_api_recipes_create_url_bulk_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/create/url/bulk"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateRecipeByUrlBulk,
  }),
  response: z.unknown(),
};

export type post_Create_recipe_from_zip_api_recipes_create_zip_post =
  typeof post_Create_recipe_from_zip_api_recipes_create_zip_post;
export const post_Create_recipe_from_zip_api_recipes_create_zip_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/create/zip"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_create_recipe_from_zip_api_recipes_create_zip_post,
  }),
  response: z.unknown(),
};

export type post_Create_recipe_from_image_api_recipes_create_image_post =
  typeof post_Create_recipe_from_image_api_recipes_create_image_post;
export const post_Create_recipe_from_image_api_recipes_create_image_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/create/image"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    query: z.object({
      translateLanguage: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_create_recipe_from_image_api_recipes_create_image_post,
  }),
  response: z.unknown(),
};

export type get_Get_all_api_recipes_get = typeof get_Get_all_api_recipes_get;
export const get_Get_all_api_recipes_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      categories: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      tags: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      tools: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      foods: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      households: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
      cookbook: z
        .union([z.string(), z.string(), z.null(), z.array(z.union([z.string(), z.string(), z.null()]))])
        .optional(),
      requireAllCategories: z.boolean().optional(),
      requireAllTags: z.boolean().optional(),
      requireAllTools: z.boolean().optional(),
      requireAllFoods: z.boolean().optional(),
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_RecipeSummary_,
};

export type post_Create_one_api_recipes_post = typeof post_Create_one_api_recipes_post;
export const post_Create_one_api_recipes_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateRecipe,
  }),
  response: z.string(),
};

export type put_Update_many_api_recipes_put = typeof put_Update_many_api_recipes_put;
export const put_Update_many_api_recipes_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(Recipe_Input),
  }),
  response: z.unknown(),
};

export type patch_Patch_many_api_recipes_patch = typeof patch_Patch_many_api_recipes_patch;
export const patch_Patch_many_api_recipes_patch = {
  method: z.literal("PATCH"),
  path: z.literal("/api/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: z.array(Recipe_Input),
  }),
  response: z.unknown(),
};

export type get_Suggest_recipes_api_recipes_suggestions_get = typeof get_Suggest_recipes_api_recipes_suggestions_get;
export const get_Suggest_recipes_api_recipes_suggestions_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/suggestions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      foods: z.union([z.array(z.string()), z.null(), z.array(z.union([z.array(z.string()), z.null()]))]).optional(),
      tools: z.union([z.array(z.string()), z.null(), z.array(z.union([z.array(z.string()), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      limit: z.number().optional(),
      maxMissingFoods: z.number().optional(),
      maxMissingTools: z.number().optional(),
      includeFoodsOnHand: z.boolean().optional(),
      includeToolsOnHand: z.boolean().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeSuggestionResponse,
};

export type get_Get_one_api_recipes__slug__get = typeof get_Get_one_api_recipes__slug__get;
export const get_Get_one_api_recipes__slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: Recipe_Output,
};

export type put_Update_one_api_recipes__slug__put = typeof put_Update_one_api_recipes__slug__put;
export const put_Update_one_api_recipes__slug__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/recipes/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Recipe_Input,
  }),
  response: z.unknown(),
};

export type patch_Patch_one_api_recipes__slug__patch = typeof patch_Patch_one_api_recipes__slug__patch;
export const patch_Patch_one_api_recipes__slug__patch = {
  method: z.literal("PATCH"),
  path: z.literal("/api/recipes/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Recipe_Input,
  }),
  response: z.unknown(),
};

export type delete_Delete_one_api_recipes__slug__delete = typeof delete_Delete_one_api_recipes__slug__delete;
export const delete_Delete_one_api_recipes__slug__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/recipes/{slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Duplicate_one_api_recipes__slug__duplicate_post =
  typeof post_Duplicate_one_api_recipes__slug__duplicate_post;
export const post_Duplicate_one_api_recipes__slug__duplicate_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/{slug}/duplicate"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeDuplicate,
  }),
  response: Recipe_Output,
};

export type patch_Update_last_made_api_recipes__slug__last_made_patch =
  typeof patch_Update_last_made_api_recipes__slug__last_made_patch;
export const patch_Update_last_made_api_recipes__slug__last_made_patch = {
  method: z.literal("PATCH"),
  path: z.literal("/api/recipes/{slug}/last-made"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeLastMade,
  }),
  response: z.unknown(),
};

export type post_Scrape_image_url_api_recipes__slug__image_post =
  typeof post_Scrape_image_url_api_recipes__slug__image_post;
export const post_Scrape_image_url_api_recipes__slug__image_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/{slug}/image"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ScrapeRecipe,
  }),
  response: z.unknown(),
};

export type put_Update_recipe_image_api_recipes__slug__image_put =
  typeof put_Update_recipe_image_api_recipes__slug__image_put;
export const put_Update_recipe_image_api_recipes__slug__image_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/recipes/{slug}/image"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_update_recipe_image_api_recipes__slug__image_put,
  }),
  response: UpdateImageResponse,
};

export type post_Upload_recipe_asset_api_recipes__slug__assets_post =
  typeof post_Upload_recipe_asset_api_recipes__slug__assets_post;
export const post_Upload_recipe_asset_api_recipes__slug__assets_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/{slug}/assets"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_upload_recipe_asset_api_recipes__slug__assets_post,
  }),
  response: RecipeAsset,
};

export type get_Get_recipe_comments_api_recipes__slug__comments_get =
  typeof get_Get_recipe_comments_api_recipes__slug__comments_get;
export const get_Get_recipe_comments_api_recipes__slug__comments_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/{slug}/comments"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.array(RecipeCommentOut_Output),
};

export type post_Bulk_tag_recipes_api_recipes_bulk_actions_tag_post =
  typeof post_Bulk_tag_recipes_api_recipes_bulk_actions_tag_post;
export const post_Bulk_tag_recipes_api_recipes_bulk_actions_tag_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/bulk-actions/tag"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: AssignTags,
  }),
  response: z.unknown(),
};

export type post_Bulk_settings_recipes_api_recipes_bulk_actions_settings_post =
  typeof post_Bulk_settings_recipes_api_recipes_bulk_actions_settings_post;
export const post_Bulk_settings_recipes_api_recipes_bulk_actions_settings_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/bulk-actions/settings"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: AssignSettings,
  }),
  response: z.unknown(),
};

export type post_Bulk_categorize_recipes_api_recipes_bulk_actions_categorize_post =
  typeof post_Bulk_categorize_recipes_api_recipes_bulk_actions_categorize_post;
export const post_Bulk_categorize_recipes_api_recipes_bulk_actions_categorize_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/bulk-actions/categorize"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: AssignCategories,
  }),
  response: z.unknown(),
};

export type post_Bulk_delete_recipes_api_recipes_bulk_actions_delete_post =
  typeof post_Bulk_delete_recipes_api_recipes_bulk_actions_delete_post;
export const post_Bulk_delete_recipes_api_recipes_bulk_actions_delete_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/bulk-actions/delete"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: DeleteRecipes,
  }),
  response: z.unknown(),
};

export type post_Bulk_export_recipes_api_recipes_bulk_actions_export_post =
  typeof post_Bulk_export_recipes_api_recipes_bulk_actions_export_post;
export const post_Bulk_export_recipes_api_recipes_bulk_actions_export_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/bulk-actions/export"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ExportRecipes,
  }),
  response: z.unknown(),
};

export type get_Get_exported_data_api_recipes_bulk_actions_export_get =
  typeof get_Get_exported_data_api_recipes_bulk_actions_export_get;
export const get_Get_exported_data_api_recipes_bulk_actions_export_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/bulk-actions/export"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.array(GroupDataExport),
};

export type get_Get_exported_data_token_api_recipes_bulk_actions_export_download_get =
  typeof get_Get_exported_data_token_api_recipes_bulk_actions_export_download_get;
export const get_Get_exported_data_token_api_recipes_bulk_actions_export_download_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/bulk-actions/export/download"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      path: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type delete_Purge_export_data_api_recipes_bulk_actions_export_purge_delete =
  typeof delete_Purge_export_data_api_recipes_bulk_actions_export_purge_delete;
export const delete_Purge_export_data_api_recipes_bulk_actions_export_purge_delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/recipes/bulk-actions/export/purge"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type get_Get_shared_recipe_api_recipes_shared__token_id__get =
  typeof get_Get_shared_recipe_api_recipes_shared__token_id__get;
export const get_Get_shared_recipe_api_recipes_shared__token_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/shared/{token_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      token_id: z.string(),
    }),
  }),
  response: Recipe_Output,
};

export type get_Get_all_api_recipes_timeline_events_get = typeof get_Get_all_api_recipes_timeline_events_get;
export const get_Get_all_api_recipes_timeline_events_get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/timeline/events"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTimelineEventPagination,
};

export type post_Create_one_api_recipes_timeline_events_post = typeof post_Create_one_api_recipes_timeline_events_post;
export const post_Create_one_api_recipes_timeline_events_post = {
  method: z.literal("POST"),
  path: z.literal("/api/recipes/timeline/events"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeTimelineEventIn,
  }),
  response: RecipeTimelineEventOut,
};

export type get_Get_one_api_recipes_timeline_events__item_id__get =
  typeof get_Get_one_api_recipes_timeline_events__item_id__get;
export const get_Get_one_api_recipes_timeline_events__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/recipes/timeline/events/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTimelineEventOut,
};

export type put_Update_one_api_recipes_timeline_events__item_id__put =
  typeof put_Update_one_api_recipes_timeline_events__item_id__put;
export const put_Update_one_api_recipes_timeline_events__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/recipes/timeline/events/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeTimelineEventUpdate,
  }),
  response: RecipeTimelineEventOut,
};

export type delete_Delete_one_api_recipes_timeline_events__item_id__delete =
  typeof delete_Delete_one_api_recipes_timeline_events__item_id__delete;
export const delete_Delete_one_api_recipes_timeline_events__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/recipes/timeline/events/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTimelineEventOut,
};

export type put_Update_event_image_api_recipes_timeline_events__item_id__image_put =
  typeof put_Update_event_image_api_recipes_timeline_events__item_id__image_put;
export const put_Update_event_image_api_recipes_timeline_events__item_id__image_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/recipes/timeline/events/{item_id}/image"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_update_event_image_api_recipes_timeline_events__item_id__image_put,
  }),
  response: UpdateImageResponse,
};

export type get_Get_all_api_organizers_categories_get = typeof get_Get_all_api_organizers_categories_get;
export const get_Get_all_api_organizers_categories_get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/categories"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeCategoryPagination,
};

export type post_Create_one_api_organizers_categories_post = typeof post_Create_one_api_organizers_categories_post;
export const post_Create_one_api_organizers_categories_post = {
  method: z.literal("POST"),
  path: z.literal("/api/organizers/categories"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CategoryIn,
  }),
  response: z.unknown(),
};

export type get_Get_all_empty_api_organizers_categories_empty_get =
  typeof get_Get_all_empty_api_organizers_categories_empty_get;
export const get_Get_all_empty_api_organizers_categories_empty_get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/categories/empty"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.array(CategoryBase),
};

export type get_Get_one_api_organizers_categories__item_id__get =
  typeof get_Get_one_api_organizers_categories__item_id__get;
export const get_Get_one_api_organizers_categories__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/categories/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: CategorySummary,
};

export type put_Update_one_api_organizers_categories__item_id__put =
  typeof put_Update_one_api_organizers_categories__item_id__put;
export const put_Update_one_api_organizers_categories__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/organizers/categories/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CategoryIn,
  }),
  response: CategorySummary,
};

export type delete_Delete_one_api_organizers_categories__item_id__delete =
  typeof delete_Delete_one_api_organizers_categories__item_id__delete;
export const delete_Delete_one_api_organizers_categories__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/organizers/categories/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_one_by_slug_api_organizers_categories_slug__category_slug__get =
  typeof get_Get_one_by_slug_api_organizers_categories_slug__category_slug__get;
export const get_Get_one_by_slug_api_organizers_categories_slug__category_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/categories/slug/{category_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      category_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_organizers_tags_get = typeof get_Get_all_api_organizers_tags_get;
export const get_Get_all_api_organizers_tags_get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tags"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTagPagination,
};

export type post_Create_one_api_organizers_tags_post = typeof post_Create_one_api_organizers_tags_post;
export const post_Create_one_api_organizers_tags_post = {
  method: z.literal("POST"),
  path: z.literal("/api/organizers/tags"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: TagIn,
  }),
  response: z.unknown(),
};

export type get_Get_empty_tags_api_organizers_tags_empty_get = typeof get_Get_empty_tags_api_organizers_tags_empty_get;
export const get_Get_empty_tags_api_organizers_tags_empty_get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tags/empty"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_one_api_organizers_tags__item_id__get = typeof get_Get_one_api_organizers_tags__item_id__get;
export const get_Get_one_api_organizers_tags__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tags/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTagResponse,
};

export type put_Update_one_api_organizers_tags__item_id__put = typeof put_Update_one_api_organizers_tags__item_id__put;
export const put_Update_one_api_organizers_tags__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/organizers/tags/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: TagIn,
  }),
  response: RecipeTagResponse,
};

export type delete_Delete_recipe_tag_api_organizers_tags__item_id__delete =
  typeof delete_Delete_recipe_tag_api_organizers_tags__item_id__delete;
export const delete_Delete_recipe_tag_api_organizers_tags__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/organizers/tags/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_one_by_slug_api_organizers_tags_slug__tag_slug__get =
  typeof get_Get_one_by_slug_api_organizers_tags_slug__tag_slug__get;
export const get_Get_one_by_slug_api_organizers_tags_slug__tag_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tags/slug/{tag_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      tag_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTagResponse,
};

export type get_Get_all_api_organizers_tools_get = typeof get_Get_all_api_organizers_tools_get;
export const get_Get_all_api_organizers_tools_get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tools"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeToolPagination,
};

export type post_Create_one_api_organizers_tools_post = typeof post_Create_one_api_organizers_tools_post;
export const post_Create_one_api_organizers_tools_post = {
  method: z.literal("POST"),
  path: z.literal("/api/organizers/tools"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeToolCreate,
  }),
  response: RecipeTool,
};

export type get_Get_one_api_organizers_tools__item_id__get = typeof get_Get_one_api_organizers_tools__item_id__get;
export const get_Get_one_api_organizers_tools__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tools/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTool,
};

export type put_Update_one_api_organizers_tools__item_id__put =
  typeof put_Update_one_api_organizers_tools__item_id__put;
export const put_Update_one_api_organizers_tools__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/organizers/tools/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeToolCreate,
  }),
  response: RecipeTool,
};

export type delete_Delete_one_api_organizers_tools__item_id__delete =
  typeof delete_Delete_one_api_organizers_tools__item_id__delete;
export const delete_Delete_one_api_organizers_tools__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/organizers/tools/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeTool,
};

export type get_Get_one_by_slug_api_organizers_tools_slug__tool_slug__get =
  typeof get_Get_one_by_slug_api_organizers_tools_slug__tool_slug__get;
export const get_Get_one_by_slug_api_organizers_tools_slug__tool_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/organizers/tools/slug/{tool_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      tool_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeToolResponse,
};

export type get_Get_all_api_shared_recipes_get = typeof get_Get_all_api_shared_recipes_get;
export const get_Get_all_api_shared_recipes_get = {
  method: z.literal("GET"),
  path: z.literal("/api/shared/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      recipe_id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.array(RecipeShareTokenSummary),
};

export type post_Create_one_api_shared_recipes_post = typeof post_Create_one_api_shared_recipes_post;
export const post_Create_one_api_shared_recipes_post = {
  method: z.literal("POST"),
  path: z.literal("/api/shared/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeShareTokenCreate,
  }),
  response: RecipeShareToken,
};

export type get_Get_one_api_shared_recipes__item_id__get = typeof get_Get_one_api_shared_recipes__item_id__get;
export const get_Get_one_api_shared_recipes__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/shared/recipes/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeShareToken,
};

export type delete_Delete_one_api_shared_recipes__item_id__delete =
  typeof delete_Delete_one_api_shared_recipes__item_id__delete;
export const delete_Delete_one_api_shared_recipes__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/shared/recipes/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_all_api_comments_get = typeof get_Get_all_api_comments_get;
export const get_Get_all_api_comments_get = {
  method: z.literal("GET"),
  path: z.literal("/api/comments"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeCommentPagination,
};

export type post_Create_one_api_comments_post = typeof post_Create_one_api_comments_post;
export const post_Create_one_api_comments_post = {
  method: z.literal("POST"),
  path: z.literal("/api/comments"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeCommentCreate,
  }),
  response: RecipeCommentOut_Output,
};

export type get_Get_one_api_comments__item_id__get = typeof get_Get_one_api_comments__item_id__get;
export const get_Get_one_api_comments__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/comments/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeCommentOut_Output,
};

export type put_Update_one_api_comments__item_id__put = typeof put_Update_one_api_comments__item_id__put;
export const put_Update_one_api_comments__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/comments/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: RecipeCommentUpdate,
  }),
  response: RecipeCommentOut_Output,
};

export type delete_Delete_one_api_comments__item_id__delete = typeof delete_Delete_one_api_comments__item_id__delete;
export const delete_Delete_one_api_comments__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/comments/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type post_Parse_ingredient_api_parser_ingredient_post = typeof post_Parse_ingredient_api_parser_ingredient_post;
export const post_Parse_ingredient_api_parser_ingredient_post = {
  method: z.literal("POST"),
  path: z.literal("/api/parser/ingredient"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: IngredientRequest,
  }),
  response: ParsedIngredient,
};

export type post_Parse_ingredients_api_parser_ingredients_post =
  typeof post_Parse_ingredients_api_parser_ingredients_post;
export const post_Parse_ingredients_api_parser_ingredients_post = {
  method: z.literal("POST"),
  path: z.literal("/api/parser/ingredients"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: IngredientsRequest,
  }),
  response: z.array(ParsedIngredient),
};

export type get_Get_all_api_foods_get = typeof get_Get_all_api_foods_get;
export const get_Get_all_api_foods_get = {
  method: z.literal("GET"),
  path: z.literal("/api/foods"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientFoodPagination,
};

export type post_Create_one_api_foods_post = typeof post_Create_one_api_foods_post;
export const post_Create_one_api_foods_post = {
  method: z.literal("POST"),
  path: z.literal("/api/foods"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateIngredientFood,
  }),
  response: IngredientFood_Output,
};

export type put_Merge_one_api_foods_merge_put = typeof put_Merge_one_api_foods_merge_put;
export const put_Merge_one_api_foods_merge_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/foods/merge"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: MergeFood,
  }),
  response: SuccessResponse,
};

export type get_Get_one_api_foods__item_id__get = typeof get_Get_one_api_foods__item_id__get;
export const get_Get_one_api_foods__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/foods/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientFood_Output,
};

export type put_Update_one_api_foods__item_id__put = typeof put_Update_one_api_foods__item_id__put;
export const put_Update_one_api_foods__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/foods/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateIngredientFood,
  }),
  response: IngredientFood_Output,
};

export type delete_Delete_one_api_foods__item_id__delete = typeof delete_Delete_one_api_foods__item_id__delete;
export const delete_Delete_one_api_foods__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/foods/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientFood_Output,
};

export type get_Get_all_api_units_get = typeof get_Get_all_api_units_get;
export const get_Get_all_api_units_get = {
  method: z.literal("GET"),
  path: z.literal("/api/units"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientUnitPagination,
};

export type post_Create_one_api_units_post = typeof post_Create_one_api_units_post;
export const post_Create_one_api_units_post = {
  method: z.literal("POST"),
  path: z.literal("/api/units"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateIngredientUnit,
  }),
  response: IngredientUnit_Output,
};

export type put_Merge_one_api_units_merge_put = typeof put_Merge_one_api_units_merge_put;
export const put_Merge_one_api_units_merge_put = {
  method: z.literal("PUT"),
  path: z.literal("/api/units/merge"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: MergeUnit,
  }),
  response: SuccessResponse,
};

export type get_Get_one_api_units__item_id__get = typeof get_Get_one_api_units__item_id__get;
export const get_Get_one_api_units__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/units/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientUnit_Output,
};

export type put_Update_one_api_units__item_id__put = typeof put_Update_one_api_units__item_id__put;
export const put_Update_one_api_units__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/units/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: CreateIngredientUnit,
  }),
  response: IngredientUnit_Output,
};

export type delete_Delete_one_api_units__item_id__delete = typeof delete_Delete_one_api_units__item_id__delete;
export const delete_Delete_one_api_units__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/units/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientUnit_Output,
};

export type get_Get_app_info_api_admin_about_get = typeof get_Get_app_info_api_admin_about_get;
export const get_Get_app_info_api_admin_about_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/about"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: AdminAboutInfo,
};

export type get_Get_app_statistics_api_admin_about_statistics_get =
  typeof get_Get_app_statistics_api_admin_about_statistics_get;
export const get_Get_app_statistics_api_admin_about_statistics_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/about/statistics"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: AppStatistics,
};

export type get_Check_app_config_api_admin_about_check_get = typeof get_Check_app_config_api_admin_about_check_get;
export const get_Check_app_config_api_admin_about_check_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/about/check"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: CheckAppConfig,
};

export type get_Get_all_api_admin_users_get = typeof get_Get_all_api_admin_users_get;
export const get_Get_all_api_admin_users_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/users"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserPagination,
};

export type post_Create_one_api_admin_users_post = typeof post_Create_one_api_admin_users_post;
export const post_Create_one_api_admin_users_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/users"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UserIn,
  }),
  response: UserOut,
};

export type post_Unlock_users_api_admin_users_unlock_post = typeof post_Unlock_users_api_admin_users_unlock_post;
export const post_Unlock_users_api_admin_users_unlock_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/users/unlock"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      force: z.boolean().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UnlockResults,
};

export type get_Get_one_api_admin_users__item_id__get = typeof get_Get_one_api_admin_users__item_id__get;
export const get_Get_one_api_admin_users__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/users/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserOut,
};

export type put_Update_one_api_admin_users__item_id__put = typeof put_Update_one_api_admin_users__item_id__put;
export const put_Update_one_api_admin_users__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/admin/users/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UserOut,
  }),
  response: UserOut,
};

export type delete_Delete_one_api_admin_users__item_id__delete =
  typeof delete_Delete_one_api_admin_users__item_id__delete;
export const delete_Delete_one_api_admin_users__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/admin/users/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: UserOut,
};

export type post_Generate_token_api_admin_users_password_reset_token_post =
  typeof post_Generate_token_api_admin_users_password_reset_token_post;
export const post_Generate_token_api_admin_users_password_reset_token_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/users/password-reset-token"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: ForgotPassword,
  }),
  response: PasswordResetToken,
};

export type get_Get_all_api_admin_households_get = typeof get_Get_all_api_admin_households_get;
export const get_Get_all_api_admin_households_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/households"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdPagination,
};

export type post_Create_one_api_admin_households_post = typeof post_Create_one_api_admin_households_post;
export const post_Create_one_api_admin_households_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/households"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: HouseholdCreate,
  }),
  response: HouseholdInDB,
};

export type get_Get_one_api_admin_households__item_id__get = typeof get_Get_one_api_admin_households__item_id__get;
export const get_Get_one_api_admin_households__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/households/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdInDB,
};

export type put_Update_one_api_admin_households__item_id__put =
  typeof put_Update_one_api_admin_households__item_id__put;
export const put_Update_one_api_admin_households__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/admin/households/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: UpdateHouseholdAdmin,
  }),
  response: HouseholdInDB,
};

export type delete_Delete_one_api_admin_households__item_id__delete =
  typeof delete_Delete_one_api_admin_households__item_id__delete;
export const delete_Delete_one_api_admin_households__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/admin/households/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdInDB,
};

export type get_Get_all_api_admin_groups_get = typeof get_Get_all_api_admin_groups_get;
export const get_Get_all_api_admin_groups_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/groups"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupPagination,
};

export type post_Create_one_api_admin_groups_post = typeof post_Create_one_api_admin_groups_post;
export const post_Create_one_api_admin_groups_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/groups"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: GroupBase,
  }),
  response: GroupInDB,
};

export type get_Get_one_api_admin_groups__item_id__get = typeof get_Get_one_api_admin_groups__item_id__get;
export const get_Get_one_api_admin_groups__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/groups/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupInDB,
};

export type put_Update_one_api_admin_groups__item_id__put = typeof put_Update_one_api_admin_groups__item_id__put;
export const put_Update_one_api_admin_groups__item_id__put = {
  method: z.literal("PUT"),
  path: z.literal("/api/admin/groups/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: GroupAdminUpdate,
  }),
  response: GroupInDB,
};

export type delete_Delete_one_api_admin_groups__item_id__delete =
  typeof delete_Delete_one_api_admin_groups__item_id__delete;
export const delete_Delete_one_api_admin_groups__item_id__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/admin/groups/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: GroupInDB,
};

export type get_Check_email_config_api_admin_email_get = typeof get_Check_email_config_api_admin_email_get;
export const get_Check_email_config_api_admin_email_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/email"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: EmailReady,
};

export type post_Send_test_email_api_admin_email_post = typeof post_Send_test_email_api_admin_email_post;
export const post_Send_test_email_api_admin_email_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/email"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: EmailTest,
  }),
  response: EmailSuccess,
};

export type get_Get_all_api_admin_backups_get = typeof get_Get_all_api_admin_backups_get;
export const get_Get_all_api_admin_backups_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/backups"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: AllBackups,
};

export type post_Create_one_api_admin_backups_post = typeof post_Create_one_api_admin_backups_post;
export const post_Create_one_api_admin_backups_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/backups"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type get_Get_one_api_admin_backups__file_name__get = typeof get_Get_one_api_admin_backups__file_name__get;
export const get_Get_one_api_admin_backups__file_name__get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/backups/{file_name}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      file_name: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: FileTokenResponse,
};

export type delete_Delete_one_api_admin_backups__file_name__delete =
  typeof delete_Delete_one_api_admin_backups__file_name__delete;
export const delete_Delete_one_api_admin_backups__file_name__delete = {
  method: z.literal("DELETE"),
  path: z.literal("/api/admin/backups/{file_name}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      file_name: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type post_Upload_one_api_admin_backups_upload_post = typeof post_Upload_one_api_admin_backups_upload_post;
export const post_Upload_one_api_admin_backups_upload_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/backups/upload"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_upload_one_api_admin_backups_upload_post,
  }),
  response: SuccessResponse,
};

export type post_Import_one_api_admin_backups__file_name__restore_post =
  typeof post_Import_one_api_admin_backups__file_name__restore_post;
export const post_Import_one_api_admin_backups__file_name__restore_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/backups/{file_name}/restore"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      file_name: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type get_Get_maintenance_summary_api_admin_maintenance_get =
  typeof get_Get_maintenance_summary_api_admin_maintenance_get;
export const get_Get_maintenance_summary_api_admin_maintenance_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/maintenance"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: MaintenanceSummary,
};

export type get_Get_storage_details_api_admin_maintenance_storage_get =
  typeof get_Get_storage_details_api_admin_maintenance_storage_get;
export const get_Get_storage_details_api_admin_maintenance_storage_get = {
  method: z.literal("GET"),
  path: z.literal("/api/admin/maintenance/storage"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: MaintenanceStorageDetails,
};

export type post_Clean_images_api_admin_maintenance_clean_images_post =
  typeof post_Clean_images_api_admin_maintenance_clean_images_post;
export const post_Clean_images_api_admin_maintenance_clean_images_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/maintenance/clean/images"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type post_Clean_temp_api_admin_maintenance_clean_temp_post =
  typeof post_Clean_temp_api_admin_maintenance_clean_temp_post;
export const post_Clean_temp_api_admin_maintenance_clean_temp_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/maintenance/clean/temp"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type post_Clean_recipe_folders_api_admin_maintenance_clean_recipe_folders_post =
  typeof post_Clean_recipe_folders_api_admin_maintenance_clean_recipe_folders_post;
export const post_Clean_recipe_folders_api_admin_maintenance_clean_recipe_folders_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/maintenance/clean/recipe-folders"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: SuccessResponse,
};

export type post_Debug_openai_api_admin_debug_openai_post = typeof post_Debug_openai_api_admin_debug_openai_post;
export const post_Debug_openai_api_admin_debug_openai_post = {
  method: z.literal("POST"),
  path: z.literal("/api/admin/debug/openai"),
  requestFormat: z.literal("form-data"),
  parameters: z.object({
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    body: Body_debug_openai_api_admin_debug_openai_post,
  }),
  response: DebugResponse,
};

export type get_Get_all_api_explore_groups__group_slug__foods_get =
  typeof get_Get_all_api_explore_groups__group_slug__foods_get;
export const get_Get_all_api_explore_groups__group_slug__foods_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/foods"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_IngredientFood_,
};

export type get_Get_one_api_explore_groups__group_slug__foods__item_id__get =
  typeof get_Get_one_api_explore_groups__group_slug__foods__item_id__get;
export const get_Get_one_api_explore_groups__group_slug__foods__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/foods/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: IngredientFood_Output,
};

export type get_Get_all_api_explore_groups__group_slug__households_get =
  typeof get_Get_all_api_explore_groups__group_slug__households_get;
export const get_Get_all_api_explore_groups__group_slug__households_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/households"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_HouseholdSummary_,
};

export type get_Get_household_api_explore_groups__group_slug__households__household_slug__get =
  typeof get_Get_household_api_explore_groups__group_slug__households__household_slug__get;
export const get_Get_household_api_explore_groups__group_slug__households__household_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/households/{household_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      household_slug: z.string(),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: HouseholdSummary,
};

export type get_Get_all_api_explore_groups__group_slug__organizers_categories_get =
  typeof get_Get_all_api_explore_groups__group_slug__organizers_categories_get;
export const get_Get_all_api_explore_groups__group_slug__organizers_categories_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/organizers/categories"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_RecipeCategory_,
};

export type get_Get_one_api_explore_groups__group_slug__organizers_categories__item_id__get =
  typeof get_Get_one_api_explore_groups__group_slug__organizers_categories__item_id__get;
export const get_Get_one_api_explore_groups__group_slug__organizers_categories__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/organizers/categories/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: CategoryOut,
};

export type get_Get_all_api_explore_groups__group_slug__organizers_tags_get =
  typeof get_Get_all_api_explore_groups__group_slug__organizers_tags_get;
export const get_Get_all_api_explore_groups__group_slug__organizers_tags_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/organizers/tags"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_RecipeTag_,
};

export type get_Get_one_api_explore_groups__group_slug__organizers_tags__item_id__get =
  typeof get_Get_one_api_explore_groups__group_slug__organizers_tags__item_id__get;
export const get_Get_one_api_explore_groups__group_slug__organizers_tags__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/organizers/tags/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: TagOut,
};

export type get_Get_all_api_explore_groups__group_slug__organizers_tools_get =
  typeof get_Get_all_api_explore_groups__group_slug__organizers_tools_get;
export const get_Get_all_api_explore_groups__group_slug__organizers_tools_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/organizers/tools"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_RecipeTool_,
};

export type get_Get_one_api_explore_groups__group_slug__organizers_tools__item_id__get =
  typeof get_Get_one_api_explore_groups__group_slug__organizers_tools__item_id__get;
export const get_Get_one_api_explore_groups__group_slug__organizers_tools__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/organizers/tools/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.string(),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeToolOut,
};

export type get_Get_all_api_explore_groups__group_slug__cookbooks_get =
  typeof get_Get_all_api_explore_groups__group_slug__cookbooks_get;
export const get_Get_all_api_explore_groups__group_slug__cookbooks_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/cookbooks"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_ReadCookBook_,
};

export type get_Get_one_api_explore_groups__group_slug__cookbooks__item_id__get =
  typeof get_Get_one_api_explore_groups__group_slug__cookbooks__item_id__get;
export const get_Get_one_api_explore_groups__group_slug__cookbooks__item_id__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/cookbooks/{item_id}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      item_id: z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))]),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeCookBook,
};

export type get_Get_all_api_explore_groups__group_slug__recipes_get =
  typeof get_Get_all_api_explore_groups__group_slug__recipes_get;
export const get_Get_all_api_explore_groups__group_slug__recipes_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/recipes"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      categories: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      tags: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      tools: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      foods: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      households: z
        .union([
          z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])),
          z.null(),
          z.array(
            z.union([z.array(z.union([z.string(), z.string(), z.array(z.union([z.string(), z.string()]))])), z.null()]),
          ),
        ])
        .optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
      cookbook: z
        .union([z.string(), z.string(), z.null(), z.array(z.union([z.string(), z.string(), z.null()]))])
        .optional(),
      requireAllCategories: z.boolean().optional(),
      requireAllTags: z.boolean().optional(),
      requireAllTools: z.boolean().optional(),
      requireAllFoods: z.boolean().optional(),
      search: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: PaginationBase_RecipeSummary_,
};

export type get_Suggest_recipes_api_explore_groups__group_slug__recipes_suggestions_get =
  typeof get_Suggest_recipes_api_explore_groups__group_slug__recipes_suggestions_get;
export const get_Suggest_recipes_api_explore_groups__group_slug__recipes_suggestions_get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/recipes/suggestions"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      foods: z.union([z.array(z.string()), z.null(), z.array(z.union([z.array(z.string()), z.null()]))]).optional(),
      tools: z.union([z.array(z.string()), z.null(), z.array(z.union([z.array(z.string()), z.null()]))]).optional(),
      orderBy: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      orderByNullPosition: z
        .union([OrderByNullPosition, z.null(), z.array(z.union([OrderByNullPosition, z.null()]))])
        .optional(),
      orderDirection: z.union([z.literal("asc"), z.literal("desc")]).optional(),
      queryFilter: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      paginationSeed: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
      limit: z.number().optional(),
      maxMissingFoods: z.number().optional(),
      maxMissingTools: z.number().optional(),
      includeFoodsOnHand: z.boolean().optional(),
      includeToolsOnHand: z.boolean().optional(),
    }),
    path: z.object({
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: RecipeSuggestionResponse,
};

export type get_Get_recipe_api_explore_groups__group_slug__recipes__recipe_slug__get =
  typeof get_Get_recipe_api_explore_groups__group_slug__recipes__recipe_slug__get;
export const get_Get_recipe_api_explore_groups__group_slug__recipes__recipe_slug__get = {
  method: z.literal("GET"),
  path: z.literal("/api/explore/groups/{group_slug}/recipes/{recipe_slug}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipe_slug: z.string(),
      group_slug: z.string(),
    }),
    header: z.object({
      "accept-language": z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: Recipe_Output,
};

export type get_Get_recipe_img_api_media_recipes__recipe_id__images__file_name__get =
  typeof get_Get_recipe_img_api_media_recipes__recipe_id__images__file_name__get;
export const get_Get_recipe_img_api_media_recipes__recipe_id__images__file_name__get = {
  method: z.literal("GET"),
  path: z.literal("/api/media/recipes/{recipe_id}/images/{file_name}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipe_id: z.string(),
      file_name: z.union([z.literal("original.webp"), z.literal("min-original.webp"), z.literal("tiny-original.webp")]),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_recipe_timeline_event_img_api_media_recipes__recipe_id__images_timeline__timeline_event_id___file_name__get =
  typeof get_Get_recipe_timeline_event_img_api_media_recipes__recipe_id__images_timeline__timeline_event_id___file_name__get;
export const get_Get_recipe_timeline_event_img_api_media_recipes__recipe_id__images_timeline__timeline_event_id___file_name__get =
  {
    method: z.literal("GET"),
    path: z.literal("/api/media/recipes/{recipe_id}/images/timeline/{timeline_event_id}/{file_name}"),
    requestFormat: z.literal("json"),
    parameters: z.object({
      path: z.object({
        recipe_id: z.string(),
        timeline_event_id: z.string(),
        file_name: z.union([
          z.literal("original.webp"),
          z.literal("min-original.webp"),
          z.literal("tiny-original.webp"),
        ]),
      }),
    }),
    response: z.unknown(),
  };

export type get_Get_recipe_asset_api_media_recipes__recipe_id__assets__file_name__get =
  typeof get_Get_recipe_asset_api_media_recipes__recipe_id__assets__file_name__get;
export const get_Get_recipe_asset_api_media_recipes__recipe_id__assets__file_name__get = {
  method: z.literal("GET"),
  path: z.literal("/api/media/recipes/{recipe_id}/assets/{file_name}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      recipe_id: z.string(),
      file_name: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_user_image_api_media_users__user_id___file_name__get =
  typeof get_Get_user_image_api_media_users__user_id___file_name__get;
export const get_Get_user_image_api_media_users__user_id___file_name__get = {
  method: z.literal("GET"),
  path: z.literal("/api/media/users/{user_id}/{file_name}"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    path: z.object({
      user_id: z.string(),
      file_name: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type get_Get_validation_text_api_media_docker_validate_txt_get =
  typeof get_Get_validation_text_api_media_docker_validate_txt_get;
export const get_Get_validation_text_api_media_docker_validate_txt_get = {
  method: z.literal("GET"),
  path: z.literal("/api/media/docker/validate.txt"),
  requestFormat: z.literal("json"),
  parameters: z.never(),
  response: z.unknown(),
};

export type get_Download_file_api_utils_download_get = typeof get_Download_file_api_utils_download_get;
export const get_Download_file_api_utils_download_get = {
  method: z.literal("GET"),
  path: z.literal("/api/utils/download"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      token: z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]).optional(),
    }),
  }),
  response: z.unknown(),
};

// <EndpointByMethod>
export const EndpointByMethod = {
  get: {
    "/api/app/about": get_Get_app_info_api_app_about_get,
    "/api/app/about/startup-info": get_Get_startup_info_api_app_about_startup_info_get,
    "/api/app/about/theme": get_Get_app_theme_api_app_about_theme_get,
    "/api/auth/oauth": get_Oauth_login_api_auth_oauth_get,
    "/api/auth/oauth/callback": get_Oauth_callback_api_auth_oauth_callback_get,
    "/api/auth/refresh": get_Refresh_token_api_auth_refresh_get,
    "/api/users/self": get_Get_logged_in_user_api_users_self_get,
    "/api/users/self/ratings": get_Get_logged_in_user_ratings_api_users_self_ratings_get,
    "/api/users/self/ratings/{recipe_id}":
      get_Get_logged_in_user_rating_for_recipe_api_users_self_ratings__recipe_id__get,
    "/api/users/self/favorites": get_Get_logged_in_user_favorites_api_users_self_favorites_get,
    "/api/users/{item_id}": get_Get_user_api_users__item_id__get,
    "/api/users": get_Get_all_api_users_get,
    "/api/users/{id}/ratings": get_Get_ratings_api_users__id__ratings_get,
    "/api/users/{id}/favorites": get_Get_favorites_api_users__id__favorites_get,
    "/api/households/cookbooks": get_Get_all_api_households_cookbooks_get,
    "/api/households/cookbooks/{item_id}": get_Get_one_api_households_cookbooks__item_id__get,
    "/api/households/events/notifications": get_Get_all_api_households_events_notifications_get,
    "/api/households/events/notifications/{item_id}": get_Get_one_api_households_events_notifications__item_id__get,
    "/api/households/recipe-actions": get_Get_all_api_households_recipe_actions_get,
    "/api/households/recipe-actions/{item_id}": get_Get_one_api_households_recipe_actions__item_id__get,
    "/api/households/self": get_Get_logged_in_user_household_api_households_self_get,
    "/api/households/self/recipes/{recipe_slug}":
      get_Get_household_recipe_api_households_self_recipes__recipe_slug__get,
    "/api/households/members": get_Get_household_members_api_households_members_get,
    "/api/households/preferences": get_Get_household_preferences_api_households_preferences_get,
    "/api/households/statistics": get_Get_statistics_api_households_statistics_get,
    "/api/households/invitations": get_Get_invite_tokens_api_households_invitations_get,
    "/api/households/shopping/lists": get_Get_all_api_households_shopping_lists_get,
    "/api/households/shopping/lists/{item_id}": get_Get_one_api_households_shopping_lists__item_id__get,
    "/api/households/shopping/items": get_Get_all_api_households_shopping_items_get,
    "/api/households/shopping/items/{item_id}": get_Get_one_api_households_shopping_items__item_id__get,
    "/api/households/webhooks": get_Get_all_api_households_webhooks_get,
    "/api/households/webhooks/{item_id}": get_Get_one_api_households_webhooks__item_id__get,
    "/api/households/mealplans/rules": get_Get_all_api_households_mealplans_rules_get,
    "/api/households/mealplans/rules/{item_id}": get_Get_one_api_households_mealplans_rules__item_id__get,
    "/api/households/mealplans": get_Get_all_api_households_mealplans_get,
    "/api/households/mealplans/today": get_Get_todays_meals_api_households_mealplans_today_get,
    "/api/households/mealplans/{item_id}": get_Get_one_api_households_mealplans__item_id__get,
    "/api/groups/households": get_Get_all_households_api_groups_households_get,
    "/api/groups/households/{household_slug}": get_Get_one_household_api_groups_households__household_slug__get,
    "/api/groups/self": get_Get_logged_in_user_group_api_groups_self_get,
    "/api/groups/members": get_Get_group_members_api_groups_members_get,
    "/api/groups/members/{username_or_id}": get_Get_group_member_api_groups_members__username_or_id__get,
    "/api/groups/preferences": get_Get_group_preferences_api_groups_preferences_get,
    "/api/groups/storage": get_Get_storage_api_groups_storage_get,
    "/api/groups/reports": get_Get_all_api_groups_reports_get,
    "/api/groups/reports/{item_id}": get_Get_one_api_groups_reports__item_id__get,
    "/api/groups/labels": get_Get_all_api_groups_labels_get,
    "/api/groups/labels/{item_id}": get_Get_one_api_groups_labels__item_id__get,
    "/api/recipes/exports": get_Get_recipe_formats_and_templates_api_recipes_exports_get,
    "/api/recipes/{slug}/exports": get_Get_recipe_as_format_api_recipes__slug__exports_get,
    "/api/recipes/{slug}/exports/zip": get_Get_recipe_as_zip_api_recipes__slug__exports_zip_get,
    "/api/recipes": get_Get_all_api_recipes_get,
    "/api/recipes/suggestions": get_Suggest_recipes_api_recipes_suggestions_get,
    "/api/recipes/{slug}": get_Get_one_api_recipes__slug__get,
    "/api/recipes/{slug}/comments": get_Get_recipe_comments_api_recipes__slug__comments_get,
    "/api/recipes/bulk-actions/export": get_Get_exported_data_api_recipes_bulk_actions_export_get,
    "/api/recipes/bulk-actions/export/download":
      get_Get_exported_data_token_api_recipes_bulk_actions_export_download_get,
    "/api/recipes/shared/{token_id}": get_Get_shared_recipe_api_recipes_shared__token_id__get,
    "/api/recipes/timeline/events": get_Get_all_api_recipes_timeline_events_get,
    "/api/recipes/timeline/events/{item_id}": get_Get_one_api_recipes_timeline_events__item_id__get,
    "/api/organizers/categories": get_Get_all_api_organizers_categories_get,
    "/api/organizers/categories/empty": get_Get_all_empty_api_organizers_categories_empty_get,
    "/api/organizers/categories/{item_id}": get_Get_one_api_organizers_categories__item_id__get,
    "/api/organizers/categories/slug/{category_slug}":
      get_Get_one_by_slug_api_organizers_categories_slug__category_slug__get,
    "/api/organizers/tags": get_Get_all_api_organizers_tags_get,
    "/api/organizers/tags/empty": get_Get_empty_tags_api_organizers_tags_empty_get,
    "/api/organizers/tags/{item_id}": get_Get_one_api_organizers_tags__item_id__get,
    "/api/organizers/tags/slug/{tag_slug}": get_Get_one_by_slug_api_organizers_tags_slug__tag_slug__get,
    "/api/organizers/tools": get_Get_all_api_organizers_tools_get,
    "/api/organizers/tools/{item_id}": get_Get_one_api_organizers_tools__item_id__get,
    "/api/organizers/tools/slug/{tool_slug}": get_Get_one_by_slug_api_organizers_tools_slug__tool_slug__get,
    "/api/shared/recipes": get_Get_all_api_shared_recipes_get,
    "/api/shared/recipes/{item_id}": get_Get_one_api_shared_recipes__item_id__get,
    "/api/comments": get_Get_all_api_comments_get,
    "/api/comments/{item_id}": get_Get_one_api_comments__item_id__get,
    "/api/foods": get_Get_all_api_foods_get,
    "/api/foods/{item_id}": get_Get_one_api_foods__item_id__get,
    "/api/units": get_Get_all_api_units_get,
    "/api/units/{item_id}": get_Get_one_api_units__item_id__get,
    "/api/admin/about": get_Get_app_info_api_admin_about_get,
    "/api/admin/about/statistics": get_Get_app_statistics_api_admin_about_statistics_get,
    "/api/admin/about/check": get_Check_app_config_api_admin_about_check_get,
    "/api/admin/users": get_Get_all_api_admin_users_get,
    "/api/admin/users/{item_id}": get_Get_one_api_admin_users__item_id__get,
    "/api/admin/households": get_Get_all_api_admin_households_get,
    "/api/admin/households/{item_id}": get_Get_one_api_admin_households__item_id__get,
    "/api/admin/groups": get_Get_all_api_admin_groups_get,
    "/api/admin/groups/{item_id}": get_Get_one_api_admin_groups__item_id__get,
    "/api/admin/email": get_Check_email_config_api_admin_email_get,
    "/api/admin/backups": get_Get_all_api_admin_backups_get,
    "/api/admin/backups/{file_name}": get_Get_one_api_admin_backups__file_name__get,
    "/api/admin/maintenance": get_Get_maintenance_summary_api_admin_maintenance_get,
    "/api/admin/maintenance/storage": get_Get_storage_details_api_admin_maintenance_storage_get,
    "/api/explore/groups/{group_slug}/foods": get_Get_all_api_explore_groups__group_slug__foods_get,
    "/api/explore/groups/{group_slug}/foods/{item_id}": get_Get_one_api_explore_groups__group_slug__foods__item_id__get,
    "/api/explore/groups/{group_slug}/households": get_Get_all_api_explore_groups__group_slug__households_get,
    "/api/explore/groups/{group_slug}/households/{household_slug}":
      get_Get_household_api_explore_groups__group_slug__households__household_slug__get,
    "/api/explore/groups/{group_slug}/organizers/categories":
      get_Get_all_api_explore_groups__group_slug__organizers_categories_get,
    "/api/explore/groups/{group_slug}/organizers/categories/{item_id}":
      get_Get_one_api_explore_groups__group_slug__organizers_categories__item_id__get,
    "/api/explore/groups/{group_slug}/organizers/tags": get_Get_all_api_explore_groups__group_slug__organizers_tags_get,
    "/api/explore/groups/{group_slug}/organizers/tags/{item_id}":
      get_Get_one_api_explore_groups__group_slug__organizers_tags__item_id__get,
    "/api/explore/groups/{group_slug}/organizers/tools":
      get_Get_all_api_explore_groups__group_slug__organizers_tools_get,
    "/api/explore/groups/{group_slug}/organizers/tools/{item_id}":
      get_Get_one_api_explore_groups__group_slug__organizers_tools__item_id__get,
    "/api/explore/groups/{group_slug}/cookbooks": get_Get_all_api_explore_groups__group_slug__cookbooks_get,
    "/api/explore/groups/{group_slug}/cookbooks/{item_id}":
      get_Get_one_api_explore_groups__group_slug__cookbooks__item_id__get,
    "/api/explore/groups/{group_slug}/recipes": get_Get_all_api_explore_groups__group_slug__recipes_get,
    "/api/explore/groups/{group_slug}/recipes/suggestions":
      get_Suggest_recipes_api_explore_groups__group_slug__recipes_suggestions_get,
    "/api/explore/groups/{group_slug}/recipes/{recipe_slug}":
      get_Get_recipe_api_explore_groups__group_slug__recipes__recipe_slug__get,
    "/api/media/recipes/{recipe_id}/images/{file_name}":
      get_Get_recipe_img_api_media_recipes__recipe_id__images__file_name__get,
    "/api/media/recipes/{recipe_id}/images/timeline/{timeline_event_id}/{file_name}":
      get_Get_recipe_timeline_event_img_api_media_recipes__recipe_id__images_timeline__timeline_event_id___file_name__get,
    "/api/media/recipes/{recipe_id}/assets/{file_name}":
      get_Get_recipe_asset_api_media_recipes__recipe_id__assets__file_name__get,
    "/api/media/users/{user_id}/{file_name}": get_Get_user_image_api_media_users__user_id___file_name__get,
    "/api/media/docker/validate.txt": get_Get_validation_text_api_media_docker_validate_txt_get,
    "/api/utils/download": get_Download_file_api_utils_download_get,
  },
  post: {
    "/api/auth/token": post_Get_token_api_auth_token_post,
    "/api/auth/logout": post_Logout_api_auth_logout_post,
    "/api/users/register": post_Register_new_user_api_users_register_post,
    "/api/users": post_Create_user_api_users_post,
    "/api/users/forgot-password": post_Forgot_password_api_users_forgot_password_post,
    "/api/users/reset-password": post_Reset_password_api_users_reset_password_post,
    "/api/users/{id}/image": post_Update_user_image_api_users__id__image_post,
    "/api/users/api-tokens": post_Create_api_token_api_users_api_tokens_post,
    "/api/users/{id}/ratings/{slug}": post_Set_rating_api_users__id__ratings__slug__post,
    "/api/users/{id}/favorites/{slug}": post_Add_favorite_api_users__id__favorites__slug__post,
    "/api/households/cookbooks": post_Create_one_api_households_cookbooks_post,
    "/api/households/events/notifications": post_Create_one_api_households_events_notifications_post,
    "/api/households/events/notifications/{item_id}/test":
      post_Test_notification_api_households_events_notifications__item_id__test_post,
    "/api/households/recipe-actions": post_Create_one_api_households_recipe_actions_post,
    "/api/households/recipe-actions/{item_id}/trigger/{recipe_slug}":
      post_Trigger_action_api_households_recipe_actions__item_id__trigger__recipe_slug__post,
    "/api/households/invitations": post_Create_invite_token_api_households_invitations_post,
    "/api/households/invitations/email": post_Email_invitation_api_households_invitations_email_post,
    "/api/households/shopping/lists": post_Create_one_api_households_shopping_lists_post,
    "/api/households/shopping/lists/{item_id}/recipe":
      post_Add_recipe_ingredients_to_list_api_households_shopping_lists__item_id__recipe_post,
    "/api/households/shopping/lists/{item_id}/recipe/{recipe_id}/delete":
      post_Remove_recipe_ingredients_from_list_api_households_shopping_lists__item_id__recipe__recipe_id__delete_post,
    "/api/households/shopping/items": post_Create_one_api_households_shopping_items_post,
    "/api/households/shopping/items/create-bulk": post_Create_many_api_households_shopping_items_create_bulk_post,
    "/api/households/webhooks": post_Create_one_api_households_webhooks_post,
    "/api/households/webhooks/rerun": post_Rerun_webhooks_api_households_webhooks_rerun_post,
    "/api/households/webhooks/{item_id}/test": post_Test_one_api_households_webhooks__item_id__test_post,
    "/api/households/mealplans/rules": post_Create_one_api_households_mealplans_rules_post,
    "/api/households/mealplans": post_Create_one_api_households_mealplans_post,
    "/api/households/mealplans/random": post_Create_random_meal_api_households_mealplans_random_post,
    "/api/groups/migrations": post_Start_data_migration_api_groups_migrations_post,
    "/api/groups/labels": post_Create_one_api_groups_labels_post,
    "/api/groups/seeders/foods": post_Seed_foods_api_groups_seeders_foods_post,
    "/api/groups/seeders/labels": post_Seed_labels_api_groups_seeders_labels_post,
    "/api/groups/seeders/units": post_Seed_units_api_groups_seeders_units_post,
    "/api/recipes/{slug}/exports": post_Get_recipe_zip_token_api_recipes__slug__exports_post,
    "/api/recipes/test-scrape-url": post_Test_parse_recipe_url_api_recipes_test_scrape_url_post,
    "/api/recipes/create/html-or-json": post_Create_recipe_from_html_or_json_api_recipes_create_html_or_json_post,
    "/api/recipes/create/url": post_Parse_recipe_url_api_recipes_create_url_post,
    "/api/recipes/create/url/bulk": post_Parse_recipe_url_bulk_api_recipes_create_url_bulk_post,
    "/api/recipes/create/zip": post_Create_recipe_from_zip_api_recipes_create_zip_post,
    "/api/recipes/create/image": post_Create_recipe_from_image_api_recipes_create_image_post,
    "/api/recipes": post_Create_one_api_recipes_post,
    "/api/recipes/{slug}/duplicate": post_Duplicate_one_api_recipes__slug__duplicate_post,
    "/api/recipes/{slug}/image": post_Scrape_image_url_api_recipes__slug__image_post,
    "/api/recipes/{slug}/assets": post_Upload_recipe_asset_api_recipes__slug__assets_post,
    "/api/recipes/bulk-actions/tag": post_Bulk_tag_recipes_api_recipes_bulk_actions_tag_post,
    "/api/recipes/bulk-actions/settings": post_Bulk_settings_recipes_api_recipes_bulk_actions_settings_post,
    "/api/recipes/bulk-actions/categorize": post_Bulk_categorize_recipes_api_recipes_bulk_actions_categorize_post,
    "/api/recipes/bulk-actions/delete": post_Bulk_delete_recipes_api_recipes_bulk_actions_delete_post,
    "/api/recipes/bulk-actions/export": post_Bulk_export_recipes_api_recipes_bulk_actions_export_post,
    "/api/recipes/timeline/events": post_Create_one_api_recipes_timeline_events_post,
    "/api/organizers/categories": post_Create_one_api_organizers_categories_post,
    "/api/organizers/tags": post_Create_one_api_organizers_tags_post,
    "/api/organizers/tools": post_Create_one_api_organizers_tools_post,
    "/api/shared/recipes": post_Create_one_api_shared_recipes_post,
    "/api/comments": post_Create_one_api_comments_post,
    "/api/parser/ingredient": post_Parse_ingredient_api_parser_ingredient_post,
    "/api/parser/ingredients": post_Parse_ingredients_api_parser_ingredients_post,
    "/api/foods": post_Create_one_api_foods_post,
    "/api/units": post_Create_one_api_units_post,
    "/api/admin/users": post_Create_one_api_admin_users_post,
    "/api/admin/users/unlock": post_Unlock_users_api_admin_users_unlock_post,
    "/api/admin/users/password-reset-token": post_Generate_token_api_admin_users_password_reset_token_post,
    "/api/admin/households": post_Create_one_api_admin_households_post,
    "/api/admin/groups": post_Create_one_api_admin_groups_post,
    "/api/admin/email": post_Send_test_email_api_admin_email_post,
    "/api/admin/backups": post_Create_one_api_admin_backups_post,
    "/api/admin/backups/upload": post_Upload_one_api_admin_backups_upload_post,
    "/api/admin/backups/{file_name}/restore": post_Import_one_api_admin_backups__file_name__restore_post,
    "/api/admin/maintenance/clean/images": post_Clean_images_api_admin_maintenance_clean_images_post,
    "/api/admin/maintenance/clean/temp": post_Clean_temp_api_admin_maintenance_clean_temp_post,
    "/api/admin/maintenance/clean/recipe-folders":
      post_Clean_recipe_folders_api_admin_maintenance_clean_recipe_folders_post,
    "/api/admin/debug/openai": post_Debug_openai_api_admin_debug_openai_post,
  },
  put: {
    "/api/users/password": put_Update_password_api_users_password_put,
    "/api/users/{item_id}": put_Update_user_api_users__item_id__put,
    "/api/households/cookbooks": put_Update_many_api_households_cookbooks_put,
    "/api/households/cookbooks/{item_id}": put_Update_one_api_households_cookbooks__item_id__put,
    "/api/households/events/notifications/{item_id}": put_Update_one_api_households_events_notifications__item_id__put,
    "/api/households/recipe-actions/{item_id}": put_Update_one_api_households_recipe_actions__item_id__put,
    "/api/households/preferences": put_Update_household_preferences_api_households_preferences_put,
    "/api/households/permissions": put_Set_member_permissions_api_households_permissions_put,
    "/api/households/shopping/lists/{item_id}": put_Update_one_api_households_shopping_lists__item_id__put,
    "/api/households/shopping/lists/{item_id}/label-settings":
      put_Update_label_settings_api_households_shopping_lists__item_id__label_settings_put,
    "/api/households/shopping/items": put_Update_many_api_households_shopping_items_put,
    "/api/households/shopping/items/{item_id}": put_Update_one_api_households_shopping_items__item_id__put,
    "/api/households/webhooks/{item_id}": put_Update_one_api_households_webhooks__item_id__put,
    "/api/households/mealplans/rules/{item_id}": put_Update_one_api_households_mealplans_rules__item_id__put,
    "/api/households/mealplans/{item_id}": put_Update_one_api_households_mealplans__item_id__put,
    "/api/groups/preferences": put_Update_group_preferences_api_groups_preferences_put,
    "/api/groups/labels/{item_id}": put_Update_one_api_groups_labels__item_id__put,
    "/api/recipes": put_Update_many_api_recipes_put,
    "/api/recipes/{slug}": put_Update_one_api_recipes__slug__put,
    "/api/recipes/{slug}/image": put_Update_recipe_image_api_recipes__slug__image_put,
    "/api/recipes/timeline/events/{item_id}": put_Update_one_api_recipes_timeline_events__item_id__put,
    "/api/recipes/timeline/events/{item_id}/image":
      put_Update_event_image_api_recipes_timeline_events__item_id__image_put,
    "/api/organizers/categories/{item_id}": put_Update_one_api_organizers_categories__item_id__put,
    "/api/organizers/tags/{item_id}": put_Update_one_api_organizers_tags__item_id__put,
    "/api/organizers/tools/{item_id}": put_Update_one_api_organizers_tools__item_id__put,
    "/api/comments/{item_id}": put_Update_one_api_comments__item_id__put,
    "/api/foods/merge": put_Merge_one_api_foods_merge_put,
    "/api/foods/{item_id}": put_Update_one_api_foods__item_id__put,
    "/api/units/merge": put_Merge_one_api_units_merge_put,
    "/api/units/{item_id}": put_Update_one_api_units__item_id__put,
    "/api/admin/users/{item_id}": put_Update_one_api_admin_users__item_id__put,
    "/api/admin/households/{item_id}": put_Update_one_api_admin_households__item_id__put,
    "/api/admin/groups/{item_id}": put_Update_one_api_admin_groups__item_id__put,
  },
  delete: {
    "/api/users/{item_id}": delete_Delete_user_api_users__item_id__delete,
    "/api/users/api-tokens/{token_id}": delete_Delete_api_token_api_users_api_tokens__token_id__delete,
    "/api/users/{id}/favorites/{slug}": delete_Remove_favorite_api_users__id__favorites__slug__delete,
    "/api/households/cookbooks/{item_id}": delete_Delete_one_api_households_cookbooks__item_id__delete,
    "/api/households/events/notifications/{item_id}":
      delete_Delete_one_api_households_events_notifications__item_id__delete,
    "/api/households/recipe-actions/{item_id}": delete_Delete_one_api_households_recipe_actions__item_id__delete,
    "/api/households/shopping/lists/{item_id}": delete_Delete_one_api_households_shopping_lists__item_id__delete,
    "/api/households/shopping/items": delete_Delete_many_api_households_shopping_items_delete,
    "/api/households/shopping/items/{item_id}": delete_Delete_one_api_households_shopping_items__item_id__delete,
    "/api/households/webhooks/{item_id}": delete_Delete_one_api_households_webhooks__item_id__delete,
    "/api/households/mealplans/rules/{item_id}": delete_Delete_one_api_households_mealplans_rules__item_id__delete,
    "/api/households/mealplans/{item_id}": delete_Delete_one_api_households_mealplans__item_id__delete,
    "/api/groups/reports/{item_id}": delete_Delete_one_api_groups_reports__item_id__delete,
    "/api/groups/labels/{item_id}": delete_Delete_one_api_groups_labels__item_id__delete,
    "/api/recipes/{slug}": delete_Delete_one_api_recipes__slug__delete,
    "/api/recipes/bulk-actions/export/purge": delete_Purge_export_data_api_recipes_bulk_actions_export_purge_delete,
    "/api/recipes/timeline/events/{item_id}": delete_Delete_one_api_recipes_timeline_events__item_id__delete,
    "/api/organizers/categories/{item_id}": delete_Delete_one_api_organizers_categories__item_id__delete,
    "/api/organizers/tags/{item_id}": delete_Delete_recipe_tag_api_organizers_tags__item_id__delete,
    "/api/organizers/tools/{item_id}": delete_Delete_one_api_organizers_tools__item_id__delete,
    "/api/shared/recipes/{item_id}": delete_Delete_one_api_shared_recipes__item_id__delete,
    "/api/comments/{item_id}": delete_Delete_one_api_comments__item_id__delete,
    "/api/foods/{item_id}": delete_Delete_one_api_foods__item_id__delete,
    "/api/units/{item_id}": delete_Delete_one_api_units__item_id__delete,
    "/api/admin/users/{item_id}": delete_Delete_one_api_admin_users__item_id__delete,
    "/api/admin/households/{item_id}": delete_Delete_one_api_admin_households__item_id__delete,
    "/api/admin/groups/{item_id}": delete_Delete_one_api_admin_groups__item_id__delete,
    "/api/admin/backups/{file_name}": delete_Delete_one_api_admin_backups__file_name__delete,
  },
  patch: {
    "/api/recipes": patch_Patch_many_api_recipes_patch,
    "/api/recipes/{slug}": patch_Patch_one_api_recipes__slug__patch,
    "/api/recipes/{slug}/last-made": patch_Update_last_made_api_recipes__slug__last_made_patch,
  },
};
export type EndpointByMethod = typeof EndpointByMethod;
// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type GetEndpoints = EndpointByMethod["get"];
export type PostEndpoints = EndpointByMethod["post"];
export type PutEndpoints = EndpointByMethod["put"];
export type DeleteEndpoints = EndpointByMethod["delete"];
export type PatchEndpoints = EndpointByMethod["patch"];
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

  // <ApiClient.patch>
  patch<Path extends keyof PatchEndpoints, TEndpoint extends PatchEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint["parameters"]>>
  ): Promise<z.infer<TEndpoint["response"]>> {
    return this.fetcher("patch", this.baseUrl + path, params[0]) as Promise<z.infer<TEndpoint["response"]>>;
  }
  // </ApiClient.patch>
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
