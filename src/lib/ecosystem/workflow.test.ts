import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import {
  OTHER_STAGE,
  STAGES,
  STAGE_IDS,
  StageGroup,
  WorkflowSection,
  examplePackages,
  groupByStage,
  isStageId,
  stageAnchorId,
  stagePackages,
  tileSections,
  toolAnchorIds,
  workflowSections,
} from '@site/src/lib/ecosystem/workflow';

/** Maps each stage id to the names of the packages grouped under it. */
function packagesByStage(groups: StageGroup[]): Record<string, string[]> {
  return Object.fromEntries(
    groups.map(({ stage, categories }) => [
      stage.id,
      categories.flatMap(({ packages }) => packages.map(pkg => pkg.name)),
    ])
  );
}

describe('STAGES', () => {
  it('lists the steps of the MEDS workflow in order, then the tools used throughout', () => {
    expect(STAGE_IDS).toEqual([
      'convert',
      'explore',
      'preprocess',
      'task',
      'model',
      'evaluate',
      'benchmark',
      'general',
    ]);
    expect(STAGES.filter(stage => !stage.step).map(stage => stage.id)).toEqual(['general']);
    for (const stage of STAGES) {
      expect(stage.title).toBeTruthy();
      expect(stage.description).toBeTruthy();
    }
  });

  it('recognizes stage ids', () => {
    expect(isStageId('model')).toBe(true);
    expect(isStageId('other')).toBe(false);
    expect(isStageId(undefined)).toBe(false);
  });
});

describe('groupByStage', () => {
  const data: Record<string, RawCategory> = {
    etls: {
      name: 'ETLs',
      stage: 'convert',
      templates: { name: 'Templates', packages: [{ name: 'template' }] } as unknown as RawCategory,
      datasets: {
        name: 'Datasets',
        packages: [{ name: 'MIMIC' }, { name: 'eICU' }],
      } as unknown as RawCategory,
    },
    tools: {
      name: 'Tools',
      tasks: { name: 'Tasks', stage: 'task', packages: [{ name: 'ACES' }] } as unknown as RawCategory,
      new_category: { name: 'New category', packages: [{ name: 'newcomer' }] } as unknown as RawCategory,
    },
  };

  it('groups packages by stage, and within a stage by category, in YAML order', () => {
    const groups = groupByStage(parseCategoryMap(data));

    expect(groups.map(group => group.stage)).toEqual([...STAGES, OTHER_STAGE]);
    const convert = groups.find(group => group.stage.id === 'convert')!;
    expect(convert.categories.map(({ category }) => category.name)).toEqual(['Templates', 'Datasets']);
    expect(convert.categories[1].packages).toEqual([
      expect.objectContaining({ name: 'MIMIC' }),
      expect.objectContaining({ name: 'eICU' }),
    ]);
    expect(packagesByStage(groups)).toEqual({
      convert: ['template', 'MIMIC', 'eICU'],
      explore: [],
      preprocess: [],
      task: ['ACES'],
      model: [],
      evaluate: [],
      benchmark: [],
      general: [],
      other: ['newcomer'],
    });
  });

  it('leaves out categories without packages of their own', () => {
    const groups = groupByStage(parseCategoryMap(data));
    const topics = groups.flatMap(group => group.categories.map(({ category }) => category.topic));
    expect(topics).not.toContain('ETLs');
    expect(topics).not.toContain('Tools');
  });
});

describe('static/data/ecosystem.yaml in the workflow flowchart', () => {
  const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
  const groups = groupByStage(parseCategoryMap(parse(fs.readFileSync(yamlPath, 'utf8'))));
  const byStage = packagesByStage(groups);

  it('lists at least one tool at every step of the workflow', () => {
    const emptySteps = STAGES.filter(stage => stage.step && byStage[stage.id].length === 0);
    expect(emptySteps.map(stage => stage.id)).toEqual([]);
  });

  it('leaves no tools under "Other tools"', () => {
    expect(byStage.other).toEqual([]);
  });

  it('places the core tools at their steps', () => {
    expect(byStage.convert).toEqual(
      expect.arrayContaining(['MEDS Extract', 'MIMIC-IV', 'OMOP (via MEDS-ETL)'])
    );
    expect(byStage.explore).toContain('MEDS-Inspect');
    expect(byStage.preprocess).toEqual(expect.arrayContaining(['MEDS-Reader', 'MEDS Transforms']));
    expect(byStage.task).toContain('ACES');
    expect(byStage.model).toEqual(expect.arrayContaining(['MEDS-Torch', 'MEDS-Tab']));
    expect(byStage.evaluate).toContain('meds-evaluation');
    expect(byStage.benchmark).toContain('MEDS-DEV');
    expect(byStage.general).toContain('MEDS Schema');
  });

  it('gives every tool one tile, with a unique id', () => {
    const sections = workflowSections(groups);
    const ids = toolAnchorIds(sections);
    const tiled = tileSections(sections).flatMap(({ categories }) =>
      categories.flatMap(({ packages }) => packages.map(pkg => pkg.name))
    );

    expect(new Set(tiled).size).toBe(tiled.length);
    expect(tiled.sort()).toEqual([...ids.keys()].sort());
    expect(new Set(ids.values()).size).toBe(ids.size);
    expect(ids.get('ACES')).toBe('tool-aces');
  });
});

describe('workflowSections', () => {
  it('numbers every step, even without tools, then adds the other groups that have tools', () => {
    const sections = workflowSections(
      groupByStage(
        parseCategoryMap({
          tasks: { name: 'Tasks', stage: 'task', packages: [{ name: 'ACES' }] },
          misc: { name: 'Misc', packages: [{ name: 'newcomer' }] },
        })
      )
    );

    expect(sections.map(({ stage, step }) => [stage.id, step])).toEqual([
      ['convert', 1],
      ['explore', 2],
      ['preprocess', 3],
      ['task', 4],
      ['model', 5],
      ['evaluate', 6],
      ['benchmark', 7],
      // "general" has no tools here.
      ['other', undefined],
    ]);
    expect(sections[3].categories[0].packages).toEqual([expect.objectContaining({ name: 'ACES' })]);
  });
});

/** A section of the flowchart with the given categories, each listing packages with the given names. */
function section(
  stageId: WorkflowSection['stage']['id'],
  categories: Record<string, string[]>
): WorkflowSection {
  const stage = [...STAGES, OTHER_STAGE].find(({ id }) => id === stageId)!;
  return {
    stage,
    step: stage.step ? STAGES.indexOf(stage) + 1 : undefined,
    categories: Object.entries(categories).map(([name, names]) => ({
      category: { topic: name, name, packages: names },
      packages: names.map(pkgName => ({ name: pkgName })),
    })),
  };
}

describe('tool tiles', () => {
  // "MEDS-ETL" is listed at two steps, and every tool of the "task" step at an earlier one.
  const sections = [
    section('convert', { ETLs: ['MEDS-ETL', 'MEDS ETL'], Datasets: ['MIMIC'] }),
    section('preprocess', { Preprocessing: ['Reader', 'MEDS-ETL'], Loading: ['MEDS-ETL'] }),
    section('task', { Tasks: ['MIMIC'] }),
    section('general', { Core: ['OMOP (via MEDS-ETL)', '🚀', '✨', 'Ünïcode'] }),
  ];

  it('gives each tool one unique id, made from its name', () => {
    expect([...toolAnchorIds(sections)]).toEqual([
      ['MEDS-ETL', 'tool-meds-etl'],
      // Names that give the same id are told apart by a number.
      ['MEDS ETL', 'tool-meds-etl-2'],
      ['MIMIC', 'tool-mimic'],
      ['Reader', 'tool-reader'],
      ['OMOP (via MEDS-ETL)', 'tool-omop-via-meds-etl'],
      // Names without letters or digits (from a-z and 0-9) still get one.
      ['🚀', 'tool'],
      ['✨', 'tool-2'],
      ['Ünïcode', 'tool-n-code'],
    ]);
  });

  it('places each tool at the first section that lists it, leaving out the sections left empty', () => {
    const tiles = tileSections(sections);

    expect(
      tiles.map(({ stage, step, categories }) => [
        stage.id,
        step,
        categories.map(({ category, packages }) => [category.name, packages.map(pkg => pkg.name)]),
      ])
    ).toEqual([
      [
        'convert',
        1,
        [
          ['ETLs', ['MEDS-ETL', 'MEDS ETL']],
          ['Datasets', ['MIMIC']],
        ],
      ],
      ['preprocess', 3, [['Preprocessing', ['Reader']]]],
      ['general', undefined, [['Core', ['OMOP (via MEDS-ETL)', '🚀', '✨', 'Ünïcode']]]],
    ]);
    // The flowchart's sections are left as they were.
    expect(sections[1].categories[0].packages).toHaveLength(2);
  });
});

describe('stageAnchorId', () => {
  it('gives each stage an id that no tool id can clash with', () => {
    expect(STAGE_IDS.map(stageAnchorId)).toEqual([
      'stage-convert',
      'stage-explore',
      'stage-preprocess',
      'stage-task',
      'stage-model',
      'stage-evaluate',
      'stage-benchmark',
      'stage-general',
    ]);
    expect(stageAnchorId(OTHER_STAGE.id)).toBe('stage-other');
  });
});

describe("a stage's tools", () => {
  // "MEDS-ETL" is listed in two categories of the stage.
  const convert = section('convert', {
    Templates: ['Template', 'MEDS-ETL'],
    Datasets: ['MIMIC', 'eICU', 'HiRID'],
    Standards: ['MEDS-ETL', 'FHIR'],
  });

  it('lists each tool once, in the order of its categories', () => {
    expect(stagePackages(convert).map(pkg => pkg.name)).toEqual([
      'Template',
      'MEDS-ETL',
      'MIMIC',
      'eICU',
      'HiRID',
      'FHIR',
    ]);
    expect(stagePackages(section('task', {}))).toEqual([]);
  });

  it('names examples from each category in turn', () => {
    const names = (count: number) => examplePackages(convert, count).map(pkg => pkg.name);
    expect(names(3)).toEqual(['Template', 'MIMIC', 'MEDS-ETL']);
    // A tool listed in several categories is named once.
    expect(names(5)).toEqual(['Template', 'MIMIC', 'MEDS-ETL', 'eICU', 'FHIR']);
    expect(names(10)).toEqual(['Template', 'MIMIC', 'MEDS-ETL', 'eICU', 'FHIR', 'HiRID']);
    expect(examplePackages(section('task', {}), 3)).toEqual([]);
  });
});
