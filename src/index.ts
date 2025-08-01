import logger from './utils/logger';
import MealieApp from './food-apps/implementations/mealie/mealie-app';
import GrocyApp from './food-apps/implementations/grocy/grocy-app';
import { formatUnits, syncUnits } from './food-apps/base/food-app-utils';

async function main(): Promise<void> {
  const mealie = new MealieApp();
  const grocy = new GrocyApp();

  await formatUnits(mealie);
  await syncUnits(mealie, grocy);

  logger.info('Exiting...');
}
main();
