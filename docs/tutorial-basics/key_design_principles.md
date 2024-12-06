---
sidebar_position: 1
---

# What is MEDS?
MEDS is a data standard for structured, longitudinal medical record data, built for reproducible, efficient
Machine Learning (ML)/Artificial Intelligence (AI) research in healthcare. It is designed to be simple,
flexible, and interoperable with existing tools and standards. MEDS is entirely open-source and
community-driven, and we welcome contributions from all interested parties! In this document, we will cover
the technical requirements and conventions of MEDS datasets. In particular, we will cover:
  1. Key terminology and concepts
  2. Requirements for a MEDS compliant dataset
  3. MEDS dataset conventions and best practices
  4. Future roadmap and how to contribute

## Key Terminology and Concepts
  1. A _subject_ in a MEDS dataset is the primary entity being described by the sequences of care observations
     in the underlying dataset. In most cases, _subjects_ will, naturally, be individuals, and the sequences
     of care observations will cover all known observations about those individuals in a source health
     datasets. However, in some cases, data may be organized so that we cannot describe all the data for an
     individual reliably in a dataset, but instead can only describe subsequences of an individual's data,
     such as in datasets that only link an individual's data observations together if they are within the same
     hospital admission, regardless of how many admissions that individual has in the dataset (such as the
     [eICU](https://eicu-crd.mit.edu/) dataset). In these cases, a _subject_ in the MEDS dataset may refer to
     a hospital admission rather than an individual.
  2. A _measurement_ in a MEDS dataset is a particular observation being made on a _subject_ either statically
     or dynamically at a point in time. _Measurements_ are the fundamental unit of data in MEDS datasets, and
     the core data schema is a longitudinal sequence of _measurements_ for each _subject_ in the dataset.
     Measurements generally fall into one of three categories, which may require different handling:
       - _static measurements_ are those that are recorded in the source dataset absent a specific timestamp
         and are assumed to be observed and applicable across all observations in the patient record. Note
         this is _not_ the same as things that are _conceptually_ assumed to be static; e.g., a patient's race
         may be recorded at each visit in a health record, and thus would be treated as a _dynamic_
         measurement _in that dataset specifically_. Likewise, some datasets may have static measurements that
         we would _conceptually_ expect to plausibly change over time, such as a patient's gender or the
         institution of care.
       - _time-derived measurements_ are measurements that vary in time, but are directly programmatically
         determinable from the timestamp of the observation and the subject's static or historic data. For
         example, a patient's age at the time of a measurement is a time-derived measurement, as it can be
         calculated from the patient's date of birth and the timestamp of the observation. Similarly, the time
         of day that a set of labs is taken is a time-derived measurement. Time-derived measurements are often
         not directly recorded in the raw data, but may be inferred or added during analysis.
       - _dynamic measurements_ are those that are recorded in the source dataset with a specific timestamp
         indicating when the observation was made. These measurements are assumed to be observed at a single
         unique point in time and are not necessarily applicable across all observations in the patient
         record. As these are recorded observations, they are generally assumed to not be programmatically
         determinable in the manner of time-derived measurements.

  3. An _event_ in a MEDS dataset is a set of measurements that are observed at a single unique point in time.
     _Measurements_ within an _event_ are not necessarily independent of each other. Further, while _event_s
     can be meaningfully ordered in time, _measurements_ within an event should not be assumed a priori to
     come with any meaningful ordering. In some cases, _event_ will be used interchangeably with
     _measurement_, but when the two terms are used distinctly, _event_ will refer to those measurements that
     share a unique timepoint, and _measurement_ will refer to the individual observations within an _event_.
  4. Within a measurement, a _code_ is the categorical descriptor of what is being observed in that
     measurement. _Code_s are not required to follow any particular coding vocabulary, and should be assumed
     to be institution specific unless otherwise specified.
  5. A _shard_ in a MEDS dataset is a single file containing a subset of the data for the dataset. Shards are
     used to split the data into manageable chunks for processing and storage. All data for a given _subject_
     must be stored in the same shard.

## Requirements for a MEDS Compliant Dataset
For a dataset to be compliant with the MEDS standard at a given version (versioning is given by the PyPi
package version), it must satisfy several requirements:
  1. It must be stored in a directory structure that is compliant with the MEDS directory structure
     specification.
  2. It must store the required data files in the required PyArrow Parquet format.
  3. It must store the required metadata files in the required JSON and PyArrow Parquet formats.

### MEDS Directory Structure Specification
The MEDS directory structure is a simple, hierarchical directory structure that is designed to be easy to use
and understand. The root directory of a MEDS dataset is referred to as the _MEDS root directory_, and all
paths within the MEDS dataset are relative to this root directory. There are two required subdirectories of
the MEDS root directory: `data/` and `metadata/`. The `data/` directory contains the MEDS data files, and the
`metadata/` directory contains the MEDS metadata files:

```plaintext
├─data/
│ └─**.parquet
│
└─metadata/
  ├─codes.parquet
  ├─dataset.json
  └─subject_splits.parquet
```

### MEDS Data File Specification
As is shown above, data files are stored in any nested (potentially multi-level) parquet files within the
`data/` folder (and all such parquet files must be data files). Each of these individual data files is a
single _shard_ of the dataset, and must follow the following specifications:
  1. It must be compliant with the
     [MEDS data schema](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L45)
  2. All data for a given _subject_ must be stored in the same shard.
  3. Shards must be sorted by `subject_id` and `time` within the shard---ordering within these groups is
     unspecified.

The [MEDS data schema](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L45)
is an [Apache Arrow](https://arrow.apache.org/) schema that specifies the required columns and data types for
MEDS data files. It currently includes the following columns:
  1. `subject_id`: A unique identifier for each subject in the dataset, of type `int64`.
  2. `time`: The time at which the measurement corresponding to this row occurred, of type `timestamp[us]`.
  3. `code`: A code representing the measurement that occurred (e.g., a diagnosis or medication code), of type
     `string`.
  4. `numeric_value`: If the measurement has a numeric value associated with it (e.g., a lab result), this
     column contains that value, of type `float32`.

All columns except `subject_id` and `code` may contain `null`s. If the `time` column is `null` it indicates a
_static_ measurement, and such rows should be sorted to the beginning of their associated subject's data. If
the `numeric_value` column is `null`, it indicates that the measurement does not have an associatecd numeric
value.

:::tip

Note that MEDS data files can contain additional columns beyond the required columns to store additional
identifiers, other data modalities, etc. to support the specific needs of a given dataset.

:::

:::tip

The MEDS data pyarrow schema can be imported from the [MEDS PyPi package](https://pypi.org/project/meds/) to
validate MEDS data files.

:::

The path from the MEDS data folder (`$MEDS_ROOT/data/`) to the shard file, "`/`" separated and without the
`.parquet` extension,  is the _shard name_.

### MEDS Metadata File Specification
As shown above, there are three key MEDS metadata files: `codes.parquet`, `dataset.json`, and
`subject_splits.parquet`.

#### `codes.parquet`
This file contains metadata about the `code` vocabulary featured in the data files. It must contain the
following three files:
  1. `code`: The code value, of type `string`.
  2. `description`: An optional free-text, human readable description of the code, of type `string`.
  3. `parent_codes`: An optional list of links to parent codes in this dataset or external ontology nodes
     associated with this code, of type `list[string]`.

Much like the data schema, the `codes.parquet` file can contain additional columns beyond the required
columns.

:::warning

It is not guaranteed that all codes will have descriptions or parent codes, or even appear as a row in the
metadata file at all! Further, the parent codes listed in this file are not guaranteed to be exhaustive or
complete.

:::

One common use of the `parent_codes` column is to link to external ontologies in the OMOP vocabulary space.
Such linkages should be formatted as `"$VOCABULARY_NAME/$CONCEPT_NAME"`; for example, a `parent_code` of
`"ICD9CM/487.0"` would be a reference to ICD9 code 487.0.

The formal schema for the `codes.parquet` file can be imported from the `meds` package and is documented
[here](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L165)

:::tip

Some libraries and models will rely on `codes.parquet` file for various tasks, such as for producing embedding
vectors of codes based on free-text descriptions, performing ontology expansion, or storing code value
statistics for normalization, etc.

:::

#### `dataset.json`
This file contains metadata about the dataset itself, including the following:
  1. `dataset_name`: The name of the dataset, of type `string`.
  2. `dataset_version`: The version of the dataset, of type `string`. Ensuring the version numbers used are
     meaningful and unique is important for reproducibility, but is ultimately not enforced by the MEDS schema
     and is left to the dataset creator.
  3. `etl_name`: The name of the ETL process used to generate the dataset, of type `string`.
  4. `etl_version`: The version of the ETL process used to generate the dataset, of type `string`.
  5. `meds_version`: The version of the MEDS standard used to generate the dataset, of type `string`.
  6. `created_at`: The timestamp at which the dataset was created, of type `string` in ISO 8601 format (note
     that this is not an official timestamp type, but rather a string representation of a timestamp as this is
     a JSON file).

The formal JSON schema for the `dataset.json` file can be imported from the `meds` package and is documented
[here](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L124)

#### `subject_splits.parquet`
This file maps subject IDs to pre-defined splits of the dataset, such as training, hyperparameter tuning, and
held-out sets. In the MEDS splits file, each row contains a `subject_id` (`int64`) and a `split` (`string`)
column, where `split` is the name of the split in which that subject lives. For the three canonical AI/ML
splits, MEDS uses the following split names:
  1. `train`: The training split. This data can be used for any purpose during model building, and in
     supervised training labels over this split will be visible to the model.
  2. `tuning`: The hyperparameter tuning split. This split is sometimes called the "dev" or "val" split in
     other contexts. This data can be used for tuning hyperparameters or for training of the final model, but
     should not be used for final evaluation of model performance. Users may choose to merge this with the
     training split then re-shuffle themselves if they need more splits or a different split ratio. Not all
     datasets will specify this split, as it is optional.
  3. `held_out`: The final evaluation held-out split. This data should not be used for training or tuning, and
     should only be used for final evaluation of model performance. This split is sometimes called the "test"
     split in other contexts. No data about these patients should be assumed to be available during data
     pre-processing, training, or tuning.

In addition to these splits, any additional custom splits as desired by the user can be used. No additional
columns are allowed in this file. The parquet schema for this file can be imported from the `meds` package and
is documented
[here](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L110)

### Labeled cohorts over a MEDS dataset
In addition to the data and metadata files, MEDS also provides a schema for defining labeled cohorts over a
MEDS dataset. Label files do not have a required on-disk organization, though it is recommended to store them
in a `labels/$COHORT_NAME/**.parquet` format within the MEDS-root directory.

**TODO**

## MEDS Dataset Conventions and Best Practices

### Recommended constants
The [`meds`](https://pypi.org/project/meds/) Python package defines a number of constants that are useful for
building maximally compatible datasets. These include:
  1. Subdirectory and file names for the required files, such as
     [`meds.data_subdirectory`](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L26)
     and
     [`meds.subject_splits_filepath`](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L104)
  2. Constants for column names and dtypes, such as
     [`meds.subject_id_column`](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L32)
     and
     [`meds.subject_id_dtype`](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L37)
  2. Codes for birth and death events:
     [`meds.birth_code =
     "MEDS_BIRTH"`](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L29)
     and
     [`meds.death_code =
     "MEDS_DEATH"`](https://github.com/Medical-Event-Data-Standard/meds/blob/main/src/meds/schema.py#L30)
  3. The three sentinel split names: **TODO**

## Future Roadmap and How to Contribute
**TODO**
