import { client } from '../../../api-clients/mealie/client.gen';
import { getEnvironmentVariable } from '../../../utils/env';
import { FoodAppBase } from '../../base/food-app';
import { MealieUnitManager } from './mealie-unit-manager';

class MealieApp implements FoodAppBase {
  private unitManager: MealieUnitManager;
  constructor() {
    client.setConfig({
      baseUrl: getEnvironmentVariable('MEALIE_URL'),
      headers: {
        Authorization: `Bearer ${getEnvironmentVariable('MEALIE_API_KEY')}`,
      },
    });
    this.unitManager = new MealieUnitManager();
  }

  toString(): string {
    return 'Mealie';
  }

  getUnitManager() {
    return this.unitManager;
  }
}
export default MealieApp;
