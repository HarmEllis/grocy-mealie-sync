import { client } from '../clients/mealie/client.gen';
import {
  getAllApiUnitsGet,
  updateOneApiUnitsItemIdPut,
  createOneApiUnitsPost,
  createOneApiHouseholdsShoppingItemsPost,
  Options,
} from '../clients/mealie/sdk.gen';
import {
  CreateIngredientUnit,
  CreateOneApiUnitsPostData,
  IngredientUnitOutput,
} from '../clients/mealie/types.gen';
import { getEnvironmentVariable } from '../helpers/environment';
import logger from '../helpers/logger';
import { DataQuery, fetchAllPaginatedItems, unitToMealieUnit } from '../helpers/mealie';
import { Unit } from '../types/foodapptypes';
import { FoodApp } from './abstracts/foodapp';

class MealieApp implements FoodApp {
  constructor() {
    client.setConfig({
      baseUrl: getEnvironmentVariable('MEALIE_URL'),
      headers: {
        Authorization: `Bearer ${getEnvironmentVariable('MEALIE_API_KEY')}`,
      },
    });
  }

  toString(): string {
    return 'Mealie';
  }

  async getAllUnits(): Promise<Unit[]> {
    // Implementation to fetch all units from Mealie
    logger.info('Retrieving units from Mealie');
    const unitOptions: DataQuery = { query: { orderBy: 'name', orderDirection: 'asc' } };
    const units: IngredientUnitOutput[] = await fetchAllPaginatedItems<IngredientUnitOutput>(
      getAllApiUnitsGet,
      unitOptions,
    );

    if (!units) {
      logger.error('No units in response from Mealie');
    } else {
      logger.info(`Retrieved ${units.length} units from Mealie`);
      logger.debug('Example unit:', units.pop());
    }
    return units;
  }

  async getUnitById(id: string): Promise<Unit | null> {
    const units = await this.getUnitsByQuery({
      orderBy: 'id',
      orderDirection: 'asc',
      queryFilter: `id = "${id}"`,
    });
    if (units.length > 1) throw new Error(`Multiple units found with id ${id}, expected one`);
    return units.shift() || null;
  }

  async getUnitByName(name: string): Promise<Unit | null> {
    const units = await this.getUnitsByQuery({
      orderBy: 'name',
      orderDirection: 'asc',
      queryFilter: `name = "${name}"`,
    });
    if (units.length > 1) throw new Error(`Multiple units found with name ${name}, expected one`);
    return units.shift() || null;
  }

  async updateUnit(unit: Unit): Promise<void> {
    logger.info(`Updating unit with name: ${unit.name}`);
    if (!unit.id) throw new Error(`Unit with name ${unit.name} does not have an ID`);
    const mealieUnit = unitToMealieUnit(unit);
    const options = {
      path: { item_id: mealieUnit.id },
      body: mealieUnit,
    };

    const result = await updateOneApiUnitsItemIdPut(options);
    if (result.error)
      throw new Error(`Failed to update unit with name ${unit.name}: ${result.error.detail}`);
  }

  async focUnit(name: string, pluralName?: string): Promise<Unit> {
    logger.info(`Fetching unit with name: ${name} and pluralName: ${pluralName}`);
    const unit = await this.getUnitByName(name);
    if (unit) return unit;
    logger.debug(`Unit with name ${name} not found, creating new unit`);
    const newUnit: Unit = {
      name: name,
      pluralName: pluralName || '',
    };
    const mealieUnit = unitToMealieUnit(newUnit);
    const options = {
      body: mealieUnit,
    };
    const createdUnit = await createOneApiUnitsPost(options);
    if (createdUnit.error)
      throw new Error(`Failed to create unit with name ${name}: ${createdUnit.error.detail}`);

    return createdUnit.data;
  }

  async formatUnits(): Promise<void> {
    const units = await this.getAllUnits();
    const unitsToFormat = units.filter(
      (unit) =>
        unit?.name.toLocaleLowerCase().localeCompare(unit?.name) ||
        unit?.pluralName?.toLocaleLowerCase().localeCompare(unit?.pluralName),
    );
    for (const unit of unitsToFormat) {
      logger.debug(`Formatting unit: ${unit.name}`);
      unit.name = unit.name.toLocaleLowerCase();
      unit.pluralName = unit.pluralName?.toLocaleLowerCase();
      await this.updateUnit(unit);
    }
  }

  async syncTo(foodApp: FoodApp): Promise<void> {
    logger.info(`Syncing units to ${foodApp.toString()}`);
    const units = await this.getAllUnits();
    for (const unit of units) {
      logger.debug(`Syncing unit: ${unit.name}`);
      const focUnit = await foodApp.focUnit(unit.name, unit.pluralName || '');
      unit.id = focUnit.id; // Ensure the unit has an ID for updating
      await foodApp.updateUnit(unit);
    }
    logger.info(`Syncing completed to ${foodApp.toString()}`);
  }

  private async getUnitsByQuery(query: DataQuery['query']): Promise<Unit[]> {
    logger.info(`Searching for unit with query '${JSON.stringify(query)}' in Mealie`);
    const unitOptions: DataQuery = {
      query: query,
    };
    const units: IngredientUnitOutput[] = await fetchAllPaginatedItems<IngredientUnitOutput>(
      getAllApiUnitsGet,
      unitOptions,
    );

    if (!units) {
      logger.error('No units in response from Mealie');
    } else {
      logger.debug(`Found ${units.length} units in Mealie`);
      if (logger.isSillyEnabled()) {
        units.forEach((unit) => logger.silly('Unit:', unit));
      }
    }
    return units;
  }
}
export default MealieApp;
