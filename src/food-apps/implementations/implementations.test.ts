import { beforeEach, describe, expect, test } from 'vitest';

import { FoodAppBase, UnitManagerBase } from '../base/food-app';
import GrocyApp from './grocy/grocy-app';
import MealieApp from './mealie/mealie-app';

const implementations = [
  {
    name: 'MealieApp',
    factory: () => new MealieApp(),
    expectedName: 'Mealie',
    unknownUnitID: '170b11e8-d5c0-472a-aa1b-ed3743a708ec',
  },
  {
    name: 'GrocyApp',
    factory: () => new GrocyApp(),
    expectedName: 'Grocy',
    unknownUnitID: '99999999',
  },
];

describe.each(implementations)(
  '$name - Tests',
  ({ name, factory, expectedName, unknownUnitID }) => {
    let foodApp: FoodAppBase;
    let unitManager: UnitManagerBase;

    beforeEach(() => {
      foodApp = factory();
      unitManager = foodApp.getUnitManager();
    });
    test('App Constuctor', () => {
      expect(foodApp).toBeDefined();
    });

    test('App toString', () => {
      expect(foodApp.toString()).toBe(expectedName);
    });

    test('App getUnitManager', () => {
      expect(unitManager).toBeDefined();
      expect(unitManager.getAllUnits).toBeDefined();
      expect(unitManager.getUnitById).toBeDefined();
      expect(unitManager.getUnitByName).toBeDefined();
      expect(unitManager.focUnit).toBeDefined();
      expect(unitManager.updateUnit).toBeDefined();
    });

    test('Get All Units', async () => {
      const units = await unitManager.getAllUnits();
      expect(units).toBeDefined();
      expect(units.length).toBeGreaterThan(0);
    });

    test('Get Unit By Id', async () => {
      const units = await unitManager.getAllUnits();
      const unit = await unitManager.getUnitById(units[0].id!);
      expect(unit).toBeDefined();
      expect(unit?.id).toBe(units[0].id);
    });
    test('Get Unit By Invalid Id', async () => {
      await expect(async () => await unitManager.getUnitById('invalid-id')).rejects.toThrowError();
    });
    test('Get Unit By unknown Id', async () => {
      const unit = await unitManager.getUnitById(unknownUnitID);
      expect(unit).toBeNull();
    });

    test('Get Unit By Name', async () => {
      const units = await unitManager.getAllUnits();
      const unit = await unitManager.getUnitByName(units[0].name);
      expect(unit).toBeDefined();
      expect(unit?.name).toBe(units[0].name);
    });
    test('Get Unit By Invalid Name', async () => {
      const unit = await unitManager.getUnitByName('invalid-name');
      expect(unit).toBeNull();
    });
  },
);
