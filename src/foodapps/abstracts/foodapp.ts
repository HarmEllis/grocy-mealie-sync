import { Unit } from '../../types/foodapptypes';

export abstract class FoodApp {
  abstract getAllUnits(): Promise<Unit[]>;
  abstract getUnitById(id: string): Promise<Unit | null>;
  abstract getUnitByName(name: string): Promise<Unit | null>;
}
