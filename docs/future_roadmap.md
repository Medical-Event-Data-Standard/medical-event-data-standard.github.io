---
sidebar_position: 5
---

# Future Roadmap
There are several critical areas of future investment for the MEDS project. These areas are outlined below,
and we welcome contributions from the community to help us achieve these goals. To contribute, please file a
[GitHub Issue](https://github.com/Medical-Event-Data-Standard/meds/issues) in the core MEDS repository. Note
that this is just a smattering of the issues we are thinking about; if you have an idea that is not listed
below, don't hesitate to reach out to us!

## Immediate Future
MEDS is currently undergoing significant expansion and development. We are actively working on the following
aspects:
  1. Improved documentation and tutorials. In addition, writing up formal, finalized papers for the MEDS
     ecosystem and MEDS-DEV benchmarking system.
  2. Additional tools, datasets, models, ETLs -- as driven by community need.
  3. Resources to make it easier to build MEDS tools, datasets, and models in a tested, validable manner.
     E.g., synthetic or demo datasets for automated testing of any new models or tools. See
     [this GitHub issue](https://github.com/Medical-Event-Data-Standard/meds/issues/44)
     to contribute to that discussion.
  4. Expanding the set of covered tasks significantly and engendering community buy-in on defining and
     collaboarating on tasks in this way.

## Near Future to Longer-term
### Multi-modality
The MEDS working group believes strongly that multi-modal data is essential for health AI. We are actively
working on integrating multi-modal data into the MEDS standard, and we welcome contributions from the
community towards this front! See
[this GitHub Issue](https://github.com/Medical-Event-Data-Standard/meds/issues/50) to add to the discussion!

### Data Visualization and Understanding
We believe that one of the key things that is missing from the Health AI ecosystem, especially for junior
students and researchers, are tools to help visualize, understand, interact with, and improve the quality of
health data. Given how paramount understanding the realities of healthcare and the data generative process, it
is essential that we have tools to help us understand the data we are working with. To help ideate and build
efforts in this space, get in touch with us and we can loop you in on further discussions on this issue
internally, or start building a tool for this yourself and let us know how we can help you!

### Support tooling-based harmonization utilities
While MEDS (intentionally) prioritizes data _standardization_ over _harmonization_, we recognize that in a
number of cases data harmonization or data linkage with external ontologies can be very valuable. There are
preliminary efforts underway to enable such efforts; if you are interested, please see [this GitHub pull
request](https://github.com/mmcdermott/MEDS_transforms/pull/206).

### Better metadata integration in MEDS-DEV
Right now, it is up to the community's best efforts to appropriately link tasks, datasets, and models together
when running specific experiments, despite the fact that, in some cases, various combinations of these three
should not go together -- e.g., we cannot study a primary care task on the MIMIC ICU datasets. We are
currently brainstorming on ways to structure this sort of dataset-task-model metadata in a way that is easy to
use and understand, and we welcome contributions to this discussion.
