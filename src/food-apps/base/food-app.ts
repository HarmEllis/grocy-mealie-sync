import { Unit } from './food-app-types';

export abstract class FoodAppBase {
  abstract toString(): string; // Returns the name of the food app
  abstract getAllUnits(): Promise<Unit[]>;
  abstract getUnitById(id: string): Promise<Unit | null>;
  abstract getUnitByName(name: string): Promise<Unit | null>;
  abstract focUnit(name: string, pluralName: string): Promise<Unit>;
  abstract updateUnit(unit: Unit): Promise<void>;
}
