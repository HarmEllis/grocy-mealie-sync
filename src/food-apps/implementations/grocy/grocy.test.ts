import { expect, test } from 'vitest';

import GrocyApp from './grocy-app';

const grocy = new GrocyApp();

test('Grocy App Constuctor', () => {
  expect(grocy).toBeDefined();
});

test('Grocy Get All Units', async () => {
  const units = await grocy.getAllUnits();
  expect(units).toBeDefined();
  expect(units.length).toBeGreaterThan(0);
});

test('Grocy Get Unit By Id', async () => {
  const units = await grocy.getAllUnits();
  const unit = await grocy.getUnitById(units[0].id);
  expect(unit).toBeDefined();
  expect(unit?.id).toBe(units[0].id);
});
test('Grocy Get Unit By Invalid Id', async () => {
  const unit = await grocy.getUnitById('invalid-id');
  expect(unit).toBeNull();
});

test('Grocy Get Unit By Name', async () => {
  const units = await grocy.getAllUnits();
  const unit = await grocy.getUnitByName(units[0].name);
  expect(unit).toBeDefined();
  expect(unit?.name).toBe(units[0].name);
});
test('Grocy Get Unit By Invalid Name', async () => {
  const unit = await grocy.getUnitByName('invalid-name');
  expect(unit).toBeNull();
});
