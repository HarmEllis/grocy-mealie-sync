import { Unit } from '../../types/foodapptypes';

export abstract class FoodApp {
  abstract toString(): string; // Returns the name of the food app
  abstract getAllUnits(): Promise<Unit[]>;
  abstract getUnitById(id: string): Promise<Unit | null>;
  abstract getUnitByName(name: string): Promise<Unit | null>;
  abstract focUnit(name: string, pluralName: string): Promise<Unit>;
  abstract updateUnit(unit: Unit): Promise<void>;
  abstract syncTo(foodApp: FoodApp): Promise<void>;
}
