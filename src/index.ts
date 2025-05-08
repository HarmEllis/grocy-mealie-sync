import logger from './helpers/logger';
import MealieApp from './foodapps/mealie';

async function main(): Promise<void> {
  const mealie = new MealieApp();
  const units = await mealie.getAllUnits();

  const unit = await mealie.getUnitByName('zakje');

  logger.info('Exiting...');
  process.exit(0);
}
main();
