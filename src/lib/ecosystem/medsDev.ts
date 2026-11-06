import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';
import type { MedsDevInfo } from './types';

/** The MEDS-DEV pages of this site (docs/MEDS-DEV/*.mdx) that list each type of entity. */
const MEDS_DEV_ENTITY_PAGES: Record<MedsEntityType, string> = {
  [MedsEntityType.DATASET]: '/docs/MEDS-DEV/datasets',
  [MedsEntityType.TASK]: '/docs/MEDS-DEV/tasks',
  [MedsEntityType.MODEL]: '/docs/MEDS-DEV/models',
};

/**
 * Site path to link to for a MEDS-DEV entity.
 *
 * The MEDS-DEV entity browser (src/components/MEDS-DEV/entities/EntityBrowser.tsx) keeps the selected entity in
 * component state, so a single entity has no URL of its own yet. Until it does, this is the page that lists all
 * entities of the same type, where the entity can be selected by its name.
 */
export function medsDevPagePath({ entityType }: MedsDevInfo): string {
  return MEDS_DEV_ENTITY_PAGES[entityType];
}
