import { FoodAppBase } from '../../base/food-app';
import { client } from '../../../api-clients/grocy/client.gen';
import { getEnvironmentVariable } from '../../../utils/env';
import { GrocyUnitManager } from './grocy-unit-manager';

class GrocyApp implements FoodAppBase {
  private unitManager: GrocyUnitManager;
  constructor() {
    // Note that the Grocy API client does not return an error if the API key is invalid,
    // it will just return an empty response
    client.setConfig({
      baseUrl: getEnvironmentVariable('GROCY_URL'),
      headers: {
        'GROCY-API-KEY': `${getEnvironmentVariable('GROCY_API_KEY')}`,
      },
    });
    this.unitManager = new GrocyUnitManager();
  }
  getUnitManager() {
    return this.unitManager;
  }
  toString(): string {
    return 'Grocy';
  }
}

export default GrocyApp;
