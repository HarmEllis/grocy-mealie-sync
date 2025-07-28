import { expect, test } from 'vitest';

import MealieApp from './mealie';

const mealie = new MealieApp();

test('Mealie App Constuctor', () => {
  expect(mealie).toBeDefined();
});

test('Mealie Get All Units', async () => {
  const units = await mealie.getAllUnits();
  expect(units).toBeDefined();
  expect(units.length).toBeGreaterThan(0);
});

test('Mealie Get Unit By Id', async () => {
  const units = await mealie.getAllUnits();
  const unit = await mealie.getUnitById(units[0].id);
  expect(unit).toBeDefined();
  expect(unit?.id).toBe(units[0].id);
});
test('Mealie Get Unit By Invalid Id', async () => {
  expect(mealie.getUnitById('invalid-id')).rejects.toThrowError(
    /^"invalid query string: invalid UUID 'invalid-id'"$/,
  );
});
test('Mealie Get Unit By unknown Id', async () => {
  const unit = await mealie.getUnitById('170b11e8-d5c0-472a-aa1b-ed3743a708ec');
  expect(unit).toBeNull();
});

test('Mealie Get Unit By Name', async () => {
  const units = await mealie.getAllUnits();
  const unit = await mealie.getUnitByName(units[0].name);
  expect(unit).toBeDefined();
  expect(unit?.name).toBe(units[0].name);
});
test('Mealie Get Unit By Invalid Name', async () => {
  const unit = await mealie.getUnitByName('invalid-name');
  expect(unit).toBeNull();
});
