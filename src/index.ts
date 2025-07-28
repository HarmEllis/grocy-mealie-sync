import logger from './helpers/logger';
import MealieApp from './foodapps/mealie';
import GrocyApp from './foodapps/grocy';

async function main(): Promise<void> {
  const mealie = new MealieApp();
  const units = await mealie.getAllUnits();
  const unit = await mealie.getUnitByName('zakje');

  const grocy = new GrocyApp();
  const grocyUnits = await grocy.getAllUnits();

  logger.info('Exiting...');
  process.exit(0);
}
main();
