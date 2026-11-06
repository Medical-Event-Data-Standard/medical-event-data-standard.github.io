import { medsDevPagePath } from '@site/src/lib/ecosystem/medsDev';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

describe('medsDevPagePath', () => {
  it.each([
    [MedsEntityType.DATASET, '/docs/MEDS-DEV/datasets'],
    [MedsEntityType.TASK, '/docs/MEDS-DEV/tasks'],
    [MedsEntityType.MODEL, '/docs/MEDS-DEV/models'],
  ])('links a %s to the MEDS-DEV page listing that type of entity', (entityType, expected) => {
    expect(medsDevPagePath({ entityType, name: 'anything' })).toBe(expected);
  });
});
