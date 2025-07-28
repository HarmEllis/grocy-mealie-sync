import { QuantityUnit } from '../clients/grocy/types.gen';
import { Unit } from '../types/foodapptypes';

export function GrocyUnitsToUnits(grocyUnits: QuantityUnit[]): Unit[] {
  return grocyUnits.map((unit) => GrocyUnitToUnit(unit));
}

export function GrocyUnitToUnit(grocyUnit: QuantityUnit): Unit {
  return {
    id: grocyUnit.id!.toString(),
    name: grocyUnit.name!,
    pluralName: grocyUnit.name_plural,
    description: grocyUnit.description,
  };
}
