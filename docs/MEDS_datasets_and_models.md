---
sidebar_position: 5
---

# Public Research Resources in MEDS

## Software Ecosystem

| Project         | Type    | Documentation URL                                      | Repository URL                                           | Paper URL                          | Description                                                                                       |
|-----------------|---------|--------------------------------------------------------|----------------------------------------------------------|------------------------------------|---------------------------------------------------------------------------------------------------|
| MEDS Schema     | Core    | [GitHub](https://github.com/Medical-Event-Data-Standard) | [GitHub](https://github.com/Medical-Event-Data-Standard/meds) | [OpenReview](https://openreview.net/forum?id=IsHy2ebjIG) | A data standard and community for building and sharing EHR machine learning tools                |
| MEDS-Reader     | Package | [Docs](https://meds-reader.readthedocs.io/en/latest/)  | [GitHub](https://github.com/som-shahlab/meds_reader)      | [arXiv](https://arxiv.org/abs/2409.09095) | An optimized Python package for efficient EHR data processing achieving 10-100x improvements in memory, speed, and disk usage |
| MEDS-Transforms | Package |                                                        | [GitHub](https://github.com/mmcdermott/MEDS_transforms)   |                                    | A set of functions and scripts for extraction to and transformation/pre-processing of MEDS-formatted data. |
| MEDS-Tab        | Package | [Docs](https://meds-tab.readthedocs.io/en/latest/)     | [GitHub](https://github.com/mmcdermott/MEDS_Tabular_AutoML) |                                    | A library designed for automated tabularization, data preparation with aggregations and time windowing. |
| ACES            | Package | [Docs](https://eventstreamaces.readthedocs.io/en/latest/) | [GitHub](https://github.com/justin13601/aces)             | [arXiv](https://arxiv.org/abs/2406.19653) | A package and configuration language for reproducible extraction of task cohorts for machine learning over event-stream datasets |
| MEDS-Torch      | Package | [Docs](https://meds-torch.readthedocs.io/en/latest/)   | [GitHub](https://github.com/Oufattole/meds-torch)         |                                    | Advancing healthcare machine learning through flexible, robust, and scalable sequence modeling tools. |
| MEDS-Evaluation | Package |                                                        | [GitHub](https://github.com/kamilest/meds-evaluation)     |                                    | Evaluation pipeline for MEDS.                                                                     |
| MEDS-ETL        | Package |                                                        | [GitHub](https://github.com/Medical-Event-Data-Standard/meds_etl) |                                    | Efficient ETL that supports OMOP, MIMIC, eICU, PyHealth.                                          |
| FEMR            | Package |                                                        | [GitHub](https://github.com/som-shahlab/femr)             |                                    | A Python package for manipulating longitudinal EHR data for machine learning, with a focus on supporting the creation of foundation models and verifying their presumed benefits in healthcare. |
| MEDS-DEV | Benchmark |  | [GitHub](https://github.com/mmcdermott/MEDS-DEV) | | A benchmark for evaluating the performance of machine learning models on MEDS-formatted data. |    

## Datasets in MEDS
  * EHRSHOT: https://ehrshot.stanford.edu

## Models in MEDS
  * CLMBR-T-base: https://huggingface.co/StanfordShahLab/clmbr-t-base
  * Context Clues (a collection of Mamba, Llama, Hyena, and GPT models across context lengths from 512 - 16,384 tokens): https://huggingface.co/collections/StanfordShahLab/context-clues-6757f893f6a2918c7ab809f1
