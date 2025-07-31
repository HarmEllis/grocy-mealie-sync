import logger from './helpers/logger';
import MealieApp from './foodapps/mealie';
import GrocyApp from './foodapps/grocy';

async function main(): Promise<void> {
  const mealie = new MealieApp();
  // const units = await mealie.getAllUnits();
  // const unit = await mealie.getUnitByName('bakje');
  await mealie.formatUnits();
  // const newUnit = await mealie.focUnit('emmer', 'emmers');

  const grocy = new GrocyApp();
  await mealie.syncTo(grocy);
  // const grocyUnits = await grocy.getAllUnits();
  // const grocyUnit = await grocy.getUnitByName('zakje');
  // const grocyFocUnit = await grocy.focUnit(unit?.name!, unit?.pluralName!);

  logger.info('Exiting...');
  process.exit(0);
}
main();
