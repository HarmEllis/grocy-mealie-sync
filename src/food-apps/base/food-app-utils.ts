import logger from '../../utils/logger';
import { FoodAppBase } from './food-app';

export async function syncUnits(appFrom: FoodAppBase, appTo: FoodAppBase): Promise<void> {
  logger.info(`Syncing units from ${appFrom.toString()} to ${appTo.toString()}`);
  const units = await appFrom.getAllUnits();
  for (const unit of units) {
    logger.debug(`Syncing unit: ${unit.name}`);
    const focUnit = await appTo.focUnit(unit.name, unit.pluralName || '');
    unit.id = focUnit.id; // Ensure the unit has an ID for updating
    await appTo.updateUnit(unit);
  }
  logger.info(
    `Synced ${units.length} unit(s) from ${appFrom.toString()} to ${appTo.toString()} successfully`,
  );
}

export async function formatUnits(app: FoodAppBase): Promise<void> {
  const units = await app.getAllUnits();
  const unitsToFormat = units.filter(
    (unit) =>
      unit?.name.toLocaleLowerCase().localeCompare(unit?.name) ||
      unit?.pluralName?.toLocaleLowerCase().localeCompare(unit?.pluralName),
  );
  for (const unit of unitsToFormat) {
    logger.debug(`Formatting unit: ${unit.name}`);
    unit.name = unit.name.toLocaleLowerCase();
    unit.pluralName = unit.pluralName?.toLocaleLowerCase();
    await app.updateUnit(unit);
  }
  logger.info(`Formatted ${unitsToFormat.length} unit(s) in ${app.toString()}`);
}
