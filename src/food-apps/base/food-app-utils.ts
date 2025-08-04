import logger from '../../utils/logger';
import { FoodAppBase } from './food-app';

export async function syncUnits(appFrom: FoodAppBase, appTo: FoodAppBase): Promise<void> {
  logger.info(`Syncing units from ${appFrom.toString()} to ${appTo.toString()}`);
  const appFromUnitManager = appFrom.getUnitManager();
  const appToUnitManager = appTo.getUnitManager();
  const units = await appFromUnitManager.getAllUnits();
  for (const unit of units) {
    logger.debug(`Syncing unit: ${unit.name}`);
    const focUnit = await appToUnitManager.focUnit(unit.name, unit.pluralName || '');
    unit.id = focUnit.id; // Ensure the unit has an ID for updating
    await appToUnitManager.updateUnit(unit);
  }
  logger.info(
    `Synced ${units.length} unit(s) from ${appFrom.toString()} to ${appTo.toString()} successfully`,
  );
}

export async function formatUnits(app: FoodAppBase): Promise<void> {
  const appUnitManager = app.getUnitManager();
  const units = await appUnitManager.getAllUnits();
  const unitsToFormat = units.filter(
    (unit) =>
      unit?.name.toLocaleLowerCase().localeCompare(unit?.name) ||
      unit?.pluralName?.toLocaleLowerCase().localeCompare(unit?.pluralName),
  );
  for (const unit of unitsToFormat) {
    logger.debug(`Formatting unit: ${unit.name}`);
    unit.name = unit.name.toLocaleLowerCase();
    unit.pluralName = unit.pluralName?.toLocaleLowerCase();
    await appUnitManager.updateUnit(unit);
  }
  logger.info(`Formatted ${unitsToFormat.length} unit(s) in ${app.toString()}`);
}
