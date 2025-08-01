import { QuantityUnit } from '../../../api-clients/grocy/types.gen';
import { Unit } from '../../base/food-app-types';

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

export function unitToGrocyUnit(unit: Unit): QuantityUnit {
  return {
    id: Number(unit.id),
    name: unit.name,
    name_plural: unit.pluralName || '',
    description: unit.description,
  };
}
