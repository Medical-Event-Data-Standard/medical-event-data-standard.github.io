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
  groupByStage,
  isStageId,
  packageLink,
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
});

describe('packageLink', () => {
  const all = {
    name: 'Pkg',
    githubRepo: 'org/repo',
    docsUrl: 'https://docs.example.org',
    physionetUrl: 'https://physionet.org/content/pkg/',
    pypiName: 'pkg',
    paperUrl: 'https://paper.example.org',
  };

  it('prefers the GitHub repository, then documentation, PhysioNet, PyPI and a paper', () => {
    expect(packageLink(all)).toEqual({ href: 'https://github.com/org/repo', label: 'GitHub' });
    expect(packageLink({ ...all, githubRepo: undefined })).toEqual({
      href: 'https://docs.example.org',
      label: 'documentation',
    });
    expect(packageLink({ ...all, githubRepo: undefined, docsUrl: undefined })).toEqual({
      href: 'https://physionet.org/content/pkg/',
      label: 'PhysioNet',
    });
    expect(packageLink({ name: 'Pkg', pypiName: 'pkg', paperUrl: all.paperUrl })).toEqual({
      href: 'https://pypi.org/project/pkg',
      label: 'PyPI',
    });
    expect(packageLink({ name: 'Pkg', paperUrl: all.paperUrl })).toEqual({
      href: 'https://paper.example.org',
      label: 'paper',
    });
  });

  it('returns undefined for a package without links', () => {
    expect(packageLink({ name: 'Pkg' })).toBeUndefined();
  });
});
