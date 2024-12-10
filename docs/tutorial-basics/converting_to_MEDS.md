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


```python
import os
from pathlib import Path

DEMO_DIR = Path(os.getenv("MEDS_DEMO_DIR", "./demo_output"))
```

### Input Dataset

### Installation


```python
MIMICIV_RAW_DIR = "https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map"
MIMICIV_PRE_MEDS_DIR = DEMO_DIR / "pre_meds/"
MIMICIV_PRE_MEDS_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = DEMO_DIR / "download/mimic-iv-demo/2.2"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

files = [
    'd_labitems_to_loinc.csv',
    'inputevents_to_rxnorm.csv',
    'lab_itemid_to_loinc.csv',
    'meas_chartevents_main.csv',
    'meas_chartevents_value.csv',
    'numerics-summary.csv',
    'outputevents_to_loinc.csv',
    'proc_datetimeevents.csv',
    'proc_itemid.csv',
    'waveforms-summary.csv'
]

for file in files:
    !wget -O {OUTPUT_DIR}/{file} {MIMICIV_RAW_DIR}/{file}
    !wget -O {MIMICIV_PRE_MEDS_DIR}/{file} {MIMICIV_RAW_DIR}/{file}
```

    --2024-12-10 10:57:46--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/d_labitems_to_loinc.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.110.133, 185.199.111.133, 185.199.108.133, ...
    connected. to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.110.133|:443... 
    HTTP request sent, awaiting response... 200 OK
    Length: 361048 (353K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/d_labitems_to_loinc.csv’
    
    demo_output/downloa 100%[===================>] 352.59K  --.-KB/s    in 0.07s   
    
    2024-12-10 10:57:47 (4.90 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/d_labitems_to_loinc.csv’ saved [361048/361048]
    
    --2024-12-10 10:57:48--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/d_labitems_to_loinc.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.109.133, 185.199.110.133, 185.199.111.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.109.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 361048 (353K) [text/plain]
    Saving to: ‘demo_output/pre_meds/d_labitems_to_loinc.csv’
    
    demo_output/pre_med 100%[===================>] 352.59K  --.-KB/s    in 0.1s    
    
    2024-12-10 10:57:48 (3.21 MB/s) - ‘demo_output/pre_meds/d_labitems_to_loinc.csv’ saved [361048/361048]
    
    --2024-12-10 10:57:48--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/inputevents_to_rxnorm.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.111.133, 185.199.108.133, 185.199.110.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.111.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 79195 (77K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/inputevents_to_rxnorm.csv’
    
    demo_output/downloa 100%[===================>]  77.34K  --.-KB/s    in 0.01s   
    
    2024-12-10 10:57:49 (6.90 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/inputevents_to_rxnorm.csv’ saved [79195/79195]
    
    --2024-12-10 10:57:49--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/inputevents_to_rxnorm.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.108.133, 185.199.110.133, 185.199.111.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.108.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 79195 (77K) [text/plain]
    Saving to: ‘demo_output/pre_meds/inputevents_to_rxnorm.csv’
    
    demo_output/pre_med 100%[===================>]  77.34K  --.-KB/s    in 0.01s   
    
    2024-12-10 10:57:49 (5.74 MB/s) - ‘demo_output/pre_meds/inputevents_to_rxnorm.csv’ saved [79195/79195]
    
    --2024-12-10 10:57:49--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/lab_itemid_to_loinc.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.108.133, 185.199.111.133, 185.199.109.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.108.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 79970 (78K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/lab_itemid_to_loinc.csv’
    
    demo_output/downloa 100%[===================>]  78.10K  --.-KB/s    in 0.01s   
    
    2024-12-10 10:57:49 (5.89 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/lab_itemid_to_loinc.csv’ saved [79970/79970]
    
    --2024-12-10 10:57:50--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/lab_itemid_to_loinc.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.110.133, 185.199.109.133, 185.199.108.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.110.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 79970 (78K) [text/plain]
    Saving to: ‘demo_output/pre_meds/lab_itemid_to_loinc.csv’
    
    demo_output/pre_med 100%[===================>]  78.10K  --.-KB/s    in 0.01s   
    
    2024-12-10 10:57:50 (6.60 MB/s) - ‘demo_output/pre_meds/lab_itemid_to_loinc.csv’ saved [79970/79970]
    
    --2024-12-10 10:57:50--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/meas_chartevents_main.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.111.133, 185.199.109.133, 185.199.110.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.111.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 34862 (34K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/meas_chartevents_main.csv’
    
    demo_output/downloa 100%[===================>]  34.04K  --.-KB/s    in 0.001s  
    
    2024-12-10 10:57:50 (39.4 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/meas_chartevents_main.csv’ saved [34862/34862]
    
    --2024-12-10 10:57:50--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/meas_chartevents_main.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.109.133, 185.199.108.133, 185.199.111.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.109.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 34862 (34K) [text/plain]
    Saving to: ‘demo_output/pre_meds/meas_chartevents_main.csv’
    
    demo_output/pre_med 100%[===================>]  34.04K  --.-KB/s    in 0.009s  
    
    2024-12-10 10:57:50 (3.76 MB/s) - ‘demo_output/pre_meds/meas_chartevents_main.csv’ saved [34862/34862]
    
    --2024-12-10 10:57:50--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/meas_chartevents_value.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.111.133, 185.199.110.133, 185.199.109.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.111.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 5902 (5.8K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/meas_chartevents_value.csv’
    
    demo_output/downloa 100%[===================>]   5.76K  --.-KB/s    in 0s      
    
    2024-12-10 10:57:51 (110 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/meas_chartevents_value.csv’ saved [5902/5902]
    
    --2024-12-10 10:57:51--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/meas_chartevents_value.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.108.133, 185.199.111.133, 185.199.109.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.108.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 5902 (5.8K) [text/plain]
    Saving to: ‘demo_output/pre_meds/meas_chartevents_value.csv’
    
    demo_output/pre_med 100%[===================>]   5.76K  --.-KB/s    in 0s      
    
    2024-12-10 10:57:51 (58.7 MB/s) - ‘demo_output/pre_meds/meas_chartevents_value.csv’ saved [5902/5902]
    
    --2024-12-10 10:57:51--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/numerics-summary.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.109.133, 185.199.110.133, 185.199.111.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.109.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 32353 (32K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/numerics-summary.csv’
    
    demo_output/downloa 100%[===================>]  31.59K  --.-KB/s    in 0.006s  
    
    2024-12-10 10:57:51 (5.56 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/numerics-summary.csv’ saved [32353/32353]
    
    --2024-12-10 10:57:51--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/numerics-summary.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.110.133, 185.199.108.133, 185.199.109.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.110.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 32353 (32K) [text/plain]
    Saving to: ‘demo_output/pre_meds/numerics-summary.csv’
    
    demo_output/pre_med 100%[===================>]  31.59K  --.-KB/s    in 0.003s  
    
    2024-12-10 10:57:52 (9.94 MB/s) - ‘demo_output/pre_meds/numerics-summary.csv’ saved [32353/32353]
    
    --2024-12-10 10:57:52--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/outputevents_to_loinc.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.111.133, 185.199.109.133, 185.199.108.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.111.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 34008 (33K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/outputevents_to_loinc.csv’
    
    demo_output/downloa 100%[===================>]  33.21K  --.-KB/s    in 0.001s  
    
    2024-12-10 10:57:52 (29.5 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/outputevents_to_loinc.csv’ saved [34008/34008]
    
    --2024-12-10 10:57:52--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/outputevents_to_loinc.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.110.133, 185.199.111.133, 185.199.108.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.110.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 34008 (33K) [text/plain]
    Saving to: ‘demo_output/pre_meds/outputevents_to_loinc.csv’
    
    demo_output/pre_med 100%[===================>]  33.21K  --.-KB/s    in 0.006s  
    
    2024-12-10 10:57:52 (5.07 MB/s) - ‘demo_output/pre_meds/outputevents_to_loinc.csv’ saved [34008/34008]
    
    --2024-12-10 10:57:52--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/proc_datetimeevents.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.109.133, 185.199.111.133, 185.199.110.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.109.133|:443... connected.
    HTTP request sent, awaiting response... 200 OK
    Length: 25205 (25K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/proc_datetimeevents.csv’
    
    demo_output/downloa 100%[===================>]  24.61K  --.-KB/s    in 0s      
    
    2024-12-10 10:57:53 (139 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/proc_datetimeevents.csv’ saved [25205/25205]
    
    --2024-12-10 10:57:53--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/proc_datetimeevents.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.111.133, 185.199.108.133, 185.199.110.133, ...
    connected. to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.111.133|:443... 
    HTTP request sent, awaiting response... 200 OK
    Length: 25205 (25K) [text/plain]
    Saving to: ‘demo_output/pre_meds/proc_datetimeevents.csv’
    
    demo_output/pre_med 100%[===================>]  24.61K  --.-KB/s    in 0.01s   
    
    2024-12-10 10:57:53 (1.90 MB/s) - ‘demo_output/pre_meds/proc_datetimeevents.csv’ saved [25205/25205]
    
    --2024-12-10 10:57:53--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/proc_itemid.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.108.133, 185.199.111.133, 185.199.110.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.108.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 21414 (21K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/proc_itemid.csv’
    
    demo_output/downloa 100%[===================>]  20.91K  --.-KB/s    in 0.001s  
    
    2024-12-10 10:57:53 (32.1 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/proc_itemid.csv’ saved [21414/21414]
    
    --2024-12-10 10:57:54--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/proc_itemid.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.109.133, 185.199.110.133, 185.199.111.133, ...
    Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.109.133|:443... connected.
    200 OKequest sent, awaiting response... 
    Length: 21414 (21K) [text/plain]
    Saving to: ‘demo_output/pre_meds/proc_itemid.csv’
    
    demo_output/pre_med 100%[===================>]  20.91K  --.-KB/s    in 0s      
    
    2024-12-10 10:57:54 (161 MB/s) - ‘demo_output/pre_meds/proc_itemid.csv’ saved [21414/21414]
    
    --2024-12-10 10:57:54--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/waveforms-summary.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.110.133, 185.199.108.133, 185.199.109.133, ...
    connected. to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.110.133|:443... 
    200 OKequest sent, awaiting response... 
    Length: 5743 (5.6K) [text/plain]
    Saving to: ‘demo_output/download/mimic-iv-demo/2.2/waveforms-summary.csv’
    
    demo_output/downloa 100%[===================>]   5.61K  --.-KB/s    in 0s      
    
    2024-12-10 10:57:54 (58.4 MB/s) - ‘demo_output/download/mimic-iv-demo/2.2/waveforms-summary.csv’ saved [5743/5743]
    
    --2024-12-10 10:57:54--  https://raw.githubusercontent.com/MIT-LCP/mimic-code/v2.4.0/mimic-iv/concepts/concept_map/waveforms-summary.csv
    Resolving raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.111.133, 185.199.108.133, 185.199.110.133, ...
    connected. to raw.githubusercontent.com (raw.githubusercontent.com)|185.199.111.133|:443... 
    HTTP request sent, awaiting response... 200 OK
    Length: 5743 (5.6K) [text/plain]
    Saving to: ‘demo_output/pre_meds/waveforms-summary.csv’
    
    demo_output/pre_med 100%[===================>]   5.61K  --.-KB/s    in 0s      
    
    2024-12-10 10:57:54 (41.7 MB/s) - ‘demo_output/pre_meds/waveforms-summary.csv’ saved [5743/5743]
    


## Extracting Data to MEDS

### Writing the Event Configuration File

### Copying the Pipeline Configuration File

### Running the Pipeline

## Advanced Topics

### Parallelizing your Pipeline

### Extracting Metadata

### Additional Post-processing



```python

```
