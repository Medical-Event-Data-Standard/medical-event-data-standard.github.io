"use strict";(self.webpackChunktemp=self.webpackChunktemp||[]).push([[247],{7002:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>o,default:()=>h,frontMatter:()=>r,metadata:()=>i,toc:()=>l});const i=JSON.parse('{"id":"tutorial-basics/converting_to_MEDS","title":"Converting to MEDS","description":"If you\'re using a public dataset, it may already be available in the MEDS format! Check out","source":"@site/docs/tutorial-basics/converting_to_MEDS.md","sourceDirName":"tutorial-basics","slug":"/tutorial-basics/converting_to_MEDS","permalink":"/docs/tutorial-basics/converting_to_MEDS","draft":false,"unlisted":false,"editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/docs/tutorial-basics/converting_to_MEDS.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"tutorialSidebar","previous":{"title":"What is MEDS?","permalink":"/docs/tutorial-basics/what_is_MEDS"},"next":{"title":"Pre-processing MEDS Data","permalink":"/docs/tutorial-basics/preprocessing_MEDS_data"}}');var s=n(4848),a=n(8453);const r={sidebar_position:2},o="Converting to MEDS",d={},l=[{value:"Tutorial Set-up",id:"tutorial-set-up",level:2},{value:"Input Dataset",id:"input-dataset",level:3},{value:"Core Folder Structure",id:"core-folder-structure",level:2},{value:"Constructing Events",id:"constructing-events",level:2},{value:"Demographics",id:"demographics",level:3},{value:"Procedures",id:"procedures",level:3},{value:"Sorting",id:"sorting",level:2},{value:"Save To Parquet",id:"save-to-parquet",level:2},{value:"Done!",id:"done",level:2}];function c(e){const t={a:"a",admonition:"admonition",blockquote:"blockquote",h1:"h1",h2:"h2",h3:"h3",header:"header",p:"p",...(0,a.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.header,{children:(0,s.jsx)(t.h1,{id:"converting-to-meds",children:"Converting to MEDS"})}),"\n",(0,s.jsx)(t.admonition,{type:"tip",children:(0,s.jsxs)(t.p,{children:["If you're using a public dataset, it may already be available in the MEDS format! Check out\n",(0,s.jsx)(t.a,{href:"/docs/MEDS_datasets_and_models",children:"our list of public datasets"})," to see if the dataset you're interested in\nis already available in MEDS format."]})}),"\n",(0,s.jsxs)(t.p,{children:["Converting your data to the MEDS format is a straightforward process that can generally be done with a few\nsimple tools and packages. In particular, if your dataset is in the OMOP format, you can use the ",(0,s.jsx)(t.a,{href:"https://github.com/Medical-Event-Data-Standard/meds_etl/tree/main?tab=readme-ov-file#omop",children:"MEDS OMOP\nETL"})," to extract\nyour data directly to the MEDS format."]}),"\n",(0,s.jsx)(t.p,{children:"Otherwise, in the below tutorial, we will demonstrate how to convert the patient and procedure table in MIMIC-IV to MEDS using simple Python."}),"\n",(0,s.jsxs)(t.p,{children:["Note that for complex ETLs, it might be worth looking into ETL support packages such as ",(0,s.jsx)(t.a,{href:"https://github.com/Medical-Event-Data-Standard/meds_etl/",children:"meds_etl"})," or ",(0,s.jsx)(t.a,{href:"https://meds-transforms.readthedocs.io/en/stable/",children:"MEDS-Transform"}),"."]}),"\n",(0,s.jsx)(t.h2,{id:"tutorial-set-up",children:"Tutorial Set-up"}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.a,{href:"https://colab.research.google.com/drive/1QNpCkDO6Z6NzdJ44-F7Hx5DSo7xT12G7",children:"https://colab.research.google.com/drive/1QNpCkDO6Z6NzdJ44-F7Hx5DSo7xT12G7"})," contains a live version of this colab."]}),"\n",(0,s.jsx)(t.p,{children:"We need to start by pip installing meds"}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"pip install meds==0.3.3"}),"\n"]}),"\n",(0,s.jsx)(t.h3,{id:"input-dataset",children:"Input Dataset"}),"\n",(0,s.jsx)(t.p,{children:"For this tutorial, we are going to be using the publicly available MIMIC-IV demo dataset."}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsxs)(t.p,{children:["wget -q -r -N -c --no-host-directories --cut-dirs=1 -np -P download ",(0,s.jsx)(t.a,{href:"https://physionet.org/files/mimic-iv-demo/2.2/",children:"https://physionet.org/files/mimic-iv-demo/2.2/"})]}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"core-folder-structure",children:"Core Folder Structure"}),"\n",(0,s.jsx)(t.p,{children:"The core folder structure of MEDS is a root folder with data and metadata subfolders."}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"!mkdir mimic-iv-demo-meds"}),"\n",(0,s.jsx)(t.p,{children:"!mkdir mimic-iv-demo-meds/data # Place to store data\n!mkdir mimic-iv-demo-meds/metadata # Place to put metadata"}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"constructing-events",children:"Constructing Events"}),"\n",(0,s.jsx)(t.p,{children:"The Medical Event Data Standard is based around converting a dataset into timestamped events."}),"\n",(0,s.jsx)(t.p,{children:"We start by creating a list to aggregate all events"}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"all_events = []"}),"\n"]}),"\n",(0,s.jsx)(t.h3,{id:"demographics",children:"Demographics"}),"\n",(0,s.jsx)(t.p,{children:"First, we want to process the demographics in the patient table. This is mainly just renaming columns."}),"\n",(0,s.jsx)(t.p,{children:"Note the use of meds.birth_code and meds.death_code to mark birth and death."}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"import meds\nimport polars as pl"}),"\n",(0,s.jsx)(t.p,{children:"patients = pl.read_csv('download/mimic-iv-demo/2.2/hosp/patients.csv.gz', infer_schema_length=0)"}),"\n",(0,s.jsx)(t.p,{children:"birth_year = pl.col('anchor_year').cast(pl.Int32) - pl.col('anchor_age').cast(pl.Int32)"}),"\n",(0,s.jsx)(t.p,{children:"birth_event = patients.select(subject_id=pl.col('subject_id').cast(pl.Int64), code=pl.lit(meds.birth_code), time=pl.datetime(birth_year, 1, 1))\ngender_event = patients.select(subject_id=pl.col('subject_id').cast(pl.Int64), code='Gender/' + pl.col('gender'), time=pl.datetime(birth_year, 1, 1))\ndeath_event = patients.select(subject_id=pl.col('subject_id').cast(pl.Int64), code=pl.lit(meds.death_code), time=pl.col('dod').str.to_datetime()).filter(pl.col('time').is_not_null())"}),"\n",(0,s.jsx)(t.p,{children:"all_events.extend([birth_event, gender_event, death_event])"}),"\n"]}),"\n",(0,s.jsx)(t.h3,{id:"procedures",children:"Procedures"}),"\n",(0,s.jsx)(t.p,{children:"Next, we want to process the procedure table. As before, this is mainly renaming columns."}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"procedures = pl.read_csv('download/mimic-iv-demo/2.2/hosp/procedures_icd.csv.gz', infer_schema_length=0)"}),"\n",(0,s.jsx)(t.p,{children:"procedure_event = procedures.select("}),"\n",(0,s.jsx)(t.h1,{id:"we-need-code-and-time",children:"We need code and time"}),"\n",(0,s.jsx)(t.p,{children:"subject_id=pl.col('subject_id').cast(pl.Int64),\ncode='ICD' + pl.col('icd_version') + '/' + pl.col('icd_code'),\ntime=pl.col('chartdate').str.to_datetime(),"}),"\n",(0,s.jsx)(t.h1,{id:"we-can-also-include-other-information",children:"We can also include other information"}),"\n",(0,s.jsx)(t.p,{children:"seq_num = pl.col('seq_num').cast(pl.Int64),\nhadm_id = pl.col('hadm_id').cast(pl.Int64),\n)"}),"\n",(0,s.jsx)(t.p,{children:"all_events.append(procedure_event)"}),"\n"]}),"\n",(0,s.jsx)(t.p,{children:"Note that we added some extra columns, seq_num and hadm_id, that are not part of the MEDS standard. MEDS supports arbitrary additional columns."}),"\n",(0,s.jsx)(t.h2,{id:"sorting",children:"Sorting"}),"\n",(0,s.jsx)(t.p,{children:"Finally, we have to sort the data by subject_id and time."}),"\n",(0,s.jsxs)(t.p,{children:["A special note is this step is often difficult for large datasets, and we recommend ",(0,s.jsx)(t.a,{href:"https://github.com/Medical-Event-Data-Standard/meds_etl?tab=readme-ov-file#meds-unsorted",children:"sort feature within meds_etl"})," when performing large ETLs."]}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"all_events_table = pl.concat(all_events, how='diagonal')\nsorted_events_table = all_events_table.sort(pl.col('subject_id'), pl.col('time'))"}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"save-to-parquet",children:"Save To Parquet"}),"\n",(0,s.jsx)(t.p,{children:"Finally, we save our data as parquet files in the necessary folder."}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:"sorted_events_table.write_parquet('mimic-iv-demo-meds/data/all_data.parquet')"}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"done",children:"Done!"}),"\n",(0,s.jsx)(t.p,{children:"The ETL for these two tables is now complete, with mimic-iv-demo-meds containing the resulting MEDS dataset."}),"\n",(0,s.jsxs)(t.p,{children:["Note that this is only an ETL for two tables with MIMIC-IV. A full ETL for MIMIC-IV can be found in ",(0,s.jsx)(t.a,{href:"https://github.com/Medical-Event-Data-Standard/meds_etl/blob/main/src/meds_etl/mimic/__init__.py",children:"https://github.com/Medical-Event-Data-Standard/meds_etl/blob/main/src/meds_etl/mimic/__init__.py"})]})]})}function h(e={}){const{wrapper:t}={...(0,a.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(c,{...e})}):c(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>r,x:()=>o});var i=n(6540);const s={},a=i.createContext(s);function r(e){const t=i.useContext(a);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),i.createElement(a.Provider,{value:t},e.children)}}}]);