---
sidebar_position: 2
---

# Converting to MEDS

:::tip

If you're using a public dataset, it may already be available in the MEDS format! Check out
[our list of public datasets](/docs/MEDS_datasets_and_models) to see if the dataset you're interested in
is already available in MEDS format.

:::

Converting your data to the MEDS format is a straightforward process that can generally be done with a few
simple tools and packages. In particular, if your dataset is in the OMOP format, you can use the [MEDS OMOP
ETL](https://github.com/Medical-Event-Data-Standard/meds_etl/tree/main?tab=readme-ov-file#omop) to extract
your data directly to the MEDS format.

Otherwise, in the below tutorial, we will demonstrate how you can use the
[MEDS-Transforms](https://meds-transforms.readthedocs.io/en/stable/) package to extract (nearly) arbitrary
input structured datasets into the MEDS format easily and efficiently.

## Tutorial Set-up

### Input Dataset

### Installation

## Extracting Data to MEDS

### Writing the Event Configuration File

### Copying the Pipeline Configuration File

### Running the Pipeline

## Advanced Topics

### Parallelizing your Pipeline

### Extracting Metadata

### Additional Post-processing
