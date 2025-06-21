---
sidebar_position: 5
---

# Future Roadmap

The MEDS project has several critical areas of future investment outlined below.
We welcome contributions from the community to help us achieve these goals.
To contribute, please file a [GitHub Issue](https://github.com/Medical-Event-Data-Standard/meds/issues) in the core MEDS repository.
This represents just some of the issues we're considering—if you have ideas not listed here, don't hesitate to reach out!

## Development Timeline

### Immediate Priorities

MEDS is currently undergoing significant expansion and development.
We are actively working on:

1. **Documentation and Research**: Improved documentation, tutorials, and formal papers for the MEDS ecosystem and MEDS-DEV benchmarking system
2. **Community-Driven Tools**: Additional tools, datasets, models, and ETLs based on community needs
3. **Development Resources**: Tools to make building MEDS components easier, e.g. [helpers for automated testing](https://github.com/Medical-Event-Data-Standard/meds_testing_helpers)
4. **Task Expansion**: Significantly expanding covered tasks and building community consensus on task definitions

### Near-Term to Long-Term Goals

#### Multi-Modal Data Support

The MEDS working group believes multi-modal data is essential for health AI.
While MEDS currently supports longitudinal, structured EHR data, we're actively working to extend support to additional modalities including:

- Free-text data (some tools already use a proposed `text_value` column, but official support is in development)
- Medical imaging
- Waveform data
- Other healthcare data types

See [GitHub Issue #50](https://github.com/Medical-Event-Data-Standard/meds/issues/50) to join the discussion!

#### Data Visualization and Understanding Tools

One key gap in the Health AI ecosystem is tools to help researchers—especially junior students—visualize, understand, and interact with health data.
Given the importance of understanding healthcare realities and data generation processes, we're developing tools to:

- Provide high-quality visualization and data exploration capabilities
- Help researchers better understand their MEDS-formatted data
- Improve data quality assessment and interaction

The ecosystem for EHR data visualization tools is currently very limited, making this a priority area.

#### Advanced Data Processing and Quality Assurance

We're building support for complex preprocessing steps common in health AI research, including:

- **Vocabulary conversion and unit standardization**
- **Structured-data summarization to free-text**
- **Large language model (LLM) integration**
- **Comprehensive data validation and error checking** to address health data's notorious noise and error rates (e.g. physiologically impossible measurements and mislabeled data)
- **Automated data cleaning tools** that work transparently and reproducibly

These capabilities will be delivered through dedicated [MEDS-Transforms](https://meds-transforms.readthedocs.io/en/stable/) stages or standalone tools as appropriate.

#### Data Harmonization Support

While MEDS intentionally prioritizes data _standardization_ over _harmonization_, we recognize that data harmonization and linkage with external ontologies can be valuable.
Preliminary efforts are underway—see [this GitHub pull request](https://github.com/mmcdermott/MEDS_transforms/pull/206) if you're interested in contributing.

#### Enhanced MEDS-DEV Metadata Integration

Currently, the community must manually ensure appropriate linkages between tasks, datasets, and models when running experiments.
However, some combinations shouldn't go together (e.g., studying primary care tasks on MIMIC ICU datasets).
We're developing structured dataset-task-model metadata systems that will be intuitive and prevent incompatible combinations.

---

_Get involved on our [GitHub](https://github.com/Medical-Event-Data-Standard/meds) to help with any of these efforts!_
