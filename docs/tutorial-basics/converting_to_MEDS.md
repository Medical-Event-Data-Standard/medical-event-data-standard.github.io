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

Otherwise, in the below tutorial, we will demonstrate how to convert the patient and procedure table in MIMIC-IV to MEDS using simple Python.

Note that for complex ETLs, it might be worth looking into ETL support packages such as [meds_etl](https://github.com/Medical-Event-Data-Standard/meds_etl/) or [MEDS-Transform](https://meds-transforms.readthedocs.io/en/stable/).


## Tutorial Set-up

https://colab.research.google.com/drive/1QNpCkDO6Z6NzdJ44-F7Hx5DSo7xT12G7 contains a live version of this colab.

We need to start by pip installing meds

> pip install meds==0.3.3

### Input Dataset

For this tutorial, we are going to be using the publicly available MIMIC-IV demo dataset.

> wget -q -r -N -c --no-host-directories --cut-dirs=1 -np -P download https://physionet.org/files/mimic-iv-demo/2.2/

## Core Folder Structure

The core folder structure of MEDS is a root folder with data and metadata subfolders.

> !mkdir mimic-iv-demo-meds
> 
> !mkdir mimic-iv-demo-meds/data # Place to store data
> !mkdir mimic-iv-demo-meds/metadata # Place to put metadata

## Constructing Events

The Medical Event Data Standard is based around converting a dataset into timestamped events.

We start by creating a list to aggregate all events

> all_events = []

### Demographics

First, we want to process the demographics in the patient table. This is mainly just renaming columns.

Note the use of meds.birth_code and meds.death_code to mark birth and death.

> import meds
> import polars as pl
> 
> patients = pl.read_csv('download/mimic-iv-demo/2.2/hosp/patients.csv.gz', infer_schema_length=0)
> 
> birth_year = pl.col('anchor_year').cast(pl.Int32) - pl.col('anchor_age').cast(pl.Int32)
> 
> 
> birth_event = patients.select(subject_id=pl.col('subject_id').cast(pl.Int64), code=pl.lit(meds.birth_code), time=pl.datetime(birth_year, 1, 1))
> 
> gender_event = patients.select(subject_id=pl.col('subject_id').cast(pl.Int64), code='Gender/' + pl.col('gender'), time=pl.datetime(birth_year, 1, 1))
> 
> death_event = patients.select(subject_id=pl.col('subject_id').cast(pl.Int64), code=pl.lit(meds.death_code), time=pl.col('dod').str.to_datetime()).filter(pl.col('time').is_not_null())
> 
> all_events.extend([birth_event, gender_event, death_event])


### Procedures

Next, we want to process the procedure table. As before, this is mainly renaming columns.

> procedures = pl.read_csv('download/mimic-iv-demo/2.2/hosp/procedures_icd.csv.gz', infer_schema_length=0)
> 
> procedure_event = procedures.select(
>                                    subject_id=pl.col('subject_id').cast(pl.Int64),
>                                    code='ICD' + pl.col('icd_version') + '/' + pl.col('icd_code'),
>                                    time=pl.col('chartdate').str.to_datetime(),
>                                    seq_num = pl.col('seq_num').cast(pl.Int64),
>                                    hadm_id = pl.col('hadm_id').cast(pl.Int64),
>                                    )
> 
> all_events.append(procedure_event)

Note that we added some extra columns, seq_num and hadm_id, that are not part of the MEDS standard. MEDS supports arbitrary additional columns.

## Sorting

Finally, we have to sort the data by subject_id and time.

A special note is this step is often difficult for large datasets, and we recommend [sort feature within meds_etl](https://github.com/Medical-Event-Data-Standard/meds_etl?tab=readme-ov-file#meds-unsorted) when performing large ETLs.

> all_events_table = pl.concat(all_events, how='diagonal')
> sorted_events_table = all_events_table.sort(pl.col('subject_id'), pl.col('time'))

## Save To Parquet

Finally, we save our data as parquet files in the necessary folder.

> sorted_events_table.write_parquet('mimic-iv-demo-meds/data/all_data.parquet')

## Done!

The ETL for these two tables is now complete, with mimic-iv-demo-meds containing the resulting MEDS dataset.

Note that this is only an ETL for two tables with MIMIC-IV. A full ETL for MIMIC-IV can be found in https://github.com/Medical-Event-Data-Standard/meds_etl/blob/main/src/meds_etl/mimic/__init__.py
