---
sidebar_position: 1
---

# The Medical Event Data Standard (MEDS)
MEDS is a data standard for structured, longitudinal medical record data, built for reproducible, efficient
Machine Learning (ML)/Artificial Intelligence (AI) research in healthcare. It is designed to be simple,
flexible, and interoperable with existing tools and standards. MEDS is entirely open-source and
community-driven, and we welcome contributions from all interested parties! This document provides a
five-minute overview of the MEDS standard and the things you can do with it consisting of 4 key parts:

  1. What is a data standard and why do we need one?
  2. What is MEDS and how can you use it?
  3. How can MEDS help with your research?
  4. Extras: Additional reading, how you can help, and citing MEDS

## What is a data standard and why do we need one?
A data standard is a set of rules and conventions for how data should be structured and stored at a technical
level. In the case of MEDS, this _does not_ include any specific requirements for the content of the data or,
for example, the coding schemes used to represent diagnoses or medications, but rather only on the structure
of the data in files and how those files should be stored on disk.

Data standards are _essential_ for enabling _reproducibility by default_ for tools, models, and algorithms
built over medical data. With a functional data standard, a model you build on your local dataset can be
re-trained from scratch on a different dataset simply by having a local collaborator run your pre-processing
and training scripts on their data, with no re-implementation required. This not only makes it easier to
collaborate and test other researchers' models across disparate datasets, but it _also makes it possible to
share engineering effort and code across research groups_. This will allow us to build an ML/AI for health
software ecosystems for our modeling needs much like those built for other fields such as `torchvision` for
computer vision and `transformers` for natural language processing.

## What is MEDS and how can you use it?
MEDS is incredibly simple, and to get started you only need to understand one key data structure: the MEDS
data schema. MEDS data files take the form of [`parquet` files](https://parquet.apache.org/) containing only
four mandatory columns (plus additional optional columns):
  1. `subject_id`: A unique identifier for each subject (e.g., patient) in the dataset.
  2. `time`: The time at which the event corresponding to this row occurred.
  3. `code`: A code representing the event that occurred (e.g., a diagnosis or medication code). The code
     vocabulary is not specified by MEDS and can be any coding scheme you choose, and will almost certainly
     include codes from many vocabularies as all events, regardless of type, are stored in the same column.
  4. `numeric_value`: If the event has a numeric value associated with it (e.g., a lab result), this column
     contains that value. If the event does not have a numeric value, this column should be `null`.

These data files are stored in the MEDS data directory (a subdirectory of the root MEDS dataset directory
called `data/`), in a _sharded_ manner, with each shard (file) containing data for a subset of
subjects in the dataset, and all data for a given subject stored in the same shard. Files are also sorted by
`subject_id` and `time` within each shard. Shards can be of uniform or varying size, and shards can be stored
in nested subdirectories of the MEDS data directory or in a flat directory structure. The _shard name_ refers
to the `'/'`-separated path to the shard file from the MEDS data directory without the `.parquet` extension.
So, in sum, if the MEDS root directory is `$MEDS_ROOT`, then the files stored in the glob
`$MEDS_ROOT/data/**/*.parquet` are the sharded MEDS data files with the file-path relative to
`$MEDS_ROOT/data` without the `.parquet` extension being the shard name.

In addition to the MEDS data schema, MEDS also specifies a set of _metadata files_ that describe the dataset
and the code vocabularies included; these files live in the `$MEDS_ROOT/metadata/` directory. They are
described in more detail alongside the rest of MEDS in the MEDS is explored in more depth in the [introductory
tutorials](tutorial-basics).

## How can MEDS help with your research?
By standardizing your data structure, MEDS makes it trivial for code you right to be transplantable to other
datasets beyond those you use for development. This means that you can share your own code or code from
colleagues across sites and datasets and have it work out of the box. In addition, this makes it easy to use
open-sourc tools developed for MEDS to empower your research. For example...

  1. If you want to pre-process your data in advance of modeling, you can use
     [MEDS-Transforms](https://meds-transforms.readthedocs.io/en/stable/) or
     [MEDS-Reader](https://meds-reader.readthedocs.io/en/stable/) to do so!
  2. If you want to extract downstream task labeling cohorts, you can use
     [ACES](https://eventstreamaces.readthedocs.io/en/stable) to do so!
  3. If you want to build PyTorch deep learning models, in particular for representation learning tasks, you
     can use [MEDS-Torch](https://meds-torch.readthedocs.io/en/stable/) to do so!
  4. If you want to use tabularize your data and make a baseline tabular model using XGBoost, you can do so
     using [MEDS-Tab](https://meds-tab.readthedocs.io/en/stable/)!

## Extras: Additional reading, how you can help, and citing MEDS
For more information on MEDS, please see the remaining tutorials on this site! In addition, you can also see
[our workshop paper](https://openreview.net/forum?id=IsHy2ebjIG). If you would like to contribute to MEDS,
please see the [MEDS GitHub repository](https://github.com/Medical-Event-Data-Standard/meds) and feel free to
file an issue or pull request there. You can also contribute new tools to the ecosystem, and if you'd like
them featured on this site, just let us know via a GitHub issue! Finally, if you use MEDS in your research,
please cite [our workshop paper](https://openreview.net/forum?id=IsHy2ebjIG). Thank you for your interest in
MEDS!
