"use strict";(self.webpackChunktemp=self.webpackChunktemp||[]).push([[976],{2053:(e,t,o)=>{o.r(t),o.d(t,{assets:()=>d,contentTitle:()=>a,default:()=>h,frontMatter:()=>r,metadata:()=>n,toc:()=>c});const n=JSON.parse('{"id":"intro","title":"Welcome to MEDS","description":"--\x3e","source":"@site/docs/intro.md","sourceDirName":".","slug":"/intro","permalink":"/docs/intro","draft":false,"unlisted":false,"editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/docs/intro.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"tutorialSidebar","next":{"title":"Tutorial - Build a Model with MEDS","permalink":"/docs/category/tutorial---build-a-model-with-meds"}}');var i=o(4848),s=o(8453);const r={sidebar_position:1},a="Welcome to MEDS",d={},c=[{value:"How can MEDS help you?",id:"how-can-meds-help-you",level:2},{value:"Doing Effective Science in Health AI",id:"doing-effective-science-in-health-ai",level:2},{value:"Where to go from here?",id:"where-to-go-from-here",level:2}];function l(e){const t={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",ol:"ol",p:"p",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"welcome-to-meds",children:"Welcome to MEDS"})}),"\n",(0,i.jsx)("center",{children:(0,i.jsx)("img",{src:"/img/ecosystem_figure.svg",alt:"The MEDS Ecosystem, Visually",width:"80%"})}),"\n",(0,i.jsx)(t.p,{children:"MEDS (the Medical Event Data Standard) is a shockingly simple, highly flexible, and efficient data standard\nfor structured, longitudinal medical record data, built for reproducible, efficient Machine Learning\n(ML)/Artificial Intelligence (AI) research in healthcare. Building on MEDS are a vareity of open-source tools\nand libraries that make it easy to work with MEDS data, from pre-processing to cohort extraction to modeling\nand beyond!"}),"\n",(0,i.jsx)(t.h2,{id:"how-can-meds-help-you",children:"How can MEDS help you?"}),"\n",(0,i.jsxs)(t.p,{children:["Working with MEDS is incredibly simple. Data in MEDS are stored in a simple, longitudinal format that consists\nof only four mandatory columns: ",(0,i.jsx)(t.code,{children:"subject_id"}),", ",(0,i.jsx)(t.code,{children:"time"}),", ",(0,i.jsx)(t.code,{children:"code"}),", and ",(0,i.jsx)(t.code,{children:"numeric_value"}),". This simplicity makes it\neasy to convert your data into MEDS and to use it when its in the MEDS format, and a number of existing\ndatasets and models already support MEDS out of the box!"]}),"\n",(0,i.jsx)(t.admonition,{type:"tip",children:(0,i.jsxs)(t.p,{children:["See ",(0,i.jsx)(t.a,{href:"/docs/MEDS_datasets_and_models",children:"this list"})," for a list of datasets and models that already support MEDS,\nand if you have a dataset that you'd like to convert to MEDS see ",(0,i.jsx)(t.a,{href:"/docs/tutorial-basics/converting_to_MEDS",children:"this\ntutorial"})," to see how!"]})}),"\n",(0,i.jsxs)(t.p,{children:["Once your data is in MEDS, you can rely on the bevy of open-source tools built on MEDS to help you with your\nmodeling tasks. Be it in ",(0,i.jsx)(t.a,{href:"https://eventstreamaces.readthedocs.io/en/stable/",children:"task-extraction"}),", data\npre-processing (with ",(0,i.jsx)(t.a,{href:"https://meds-transforms.readthedocs.io/en/stable/",children:"MEDS-Transforms"})," or\n",(0,i.jsx)(t.a,{href:"https://meds-reader.readthedocs.io/en/stable/",children:"MEDS-Reader"}),"), building\n",(0,i.jsx)(t.a,{href:"https://meds-tab.readthedocs.io/en/stable/",children:"baseline"})," or\n",(0,i.jsx)(t.a,{href:"https://meds-torch.readthedocs.io/en/stable/",children:"neural network"}),"\nmodels, or ",(0,i.jsx)(t.a,{href:"https://github.com/kamilest/meds-evaluation/tree/main",children:"evaluating predictions"}),", the MEDS\necosystem has tools that can help make your research easier, more efficient, and more reproducible."]}),"\n",(0,i.jsx)(t.h2,{id:"doing-effective-science-in-health-ai",children:"Doing Effective Science in Health AI"}),"\n",(0,i.jsxs)(t.p,{children:["MEDS is built to enable as close to ",(0,i.jsx)(t.em,{children:"frictionless reproducibility"})," as is possible in the field of health AI --\nprecisely so that we can do effective empirical science in this field and generate meaningful understanding of\nwhat works and what doesn't. By using MEDS, you can ensure that your work is reproducible by default to add\nyour insights into this communal body of evidence and to ensure that your work can build on the insights of\nothers."]}),"\n",(0,i.jsxs)(t.p,{children:["The ",(0,i.jsx)(t.a,{href:"https://github.com/mmcdermott/MEDS-DEV/",children:"MEDS Decentralized, Extensible, Validation (MEDS-DEV)"})," effort\nfacilitates exactly this kind of effective science. MEDS-DEV is a place to share task definitions (through the\n",(0,i.jsx)(t.a,{href:"https://eventstreamaces.readthedocs.io/en/stable",children:"ACES"})," framework), to share reproducible model training\nrecipes and details on publicly and privately used datasets, and to share model evaluation results in a\ndecentralized fashion over these shared tasks and datasets. This allows us to build a shared understanding of\nthe science of health AI and to ensure that our models are robust and generalizable. Contributing your model\nresults or your task definitions to MEDS-DEV is easy, as is reproducing prior models for comparison on your\nlocal data. Check out the ",(0,i.jsx)(t.a,{href:"https://github.com/mmcdermott/MEDS-DEV/",children:"MEDS-DEV GitHub repository"})," to get\nstarted!"]}),"\n",(0,i.jsx)(t.h2,{id:"where-to-go-from-here",children:"Where to go from here?"}),"\n",(0,i.jsxs)(t.ol,{children:["\n",(0,i.jsxs)(t.li,{children:["If you're new to MEDS and want to learn more about the nuts and bolts, check out the\n",(0,i.jsx)(t.a,{href:"/docs/category/tutorial---build-a-model-with-meds",children:"introductory tutorials"})," to get started!"]}),"\n",(0,i.jsxs)(t.li,{children:["IF you're looking for a dataset to work with, a model to compare to, or tools to help your research,\ncheck out the ",(0,i.jsx)(t.a,{href:"/docs/MEDS_datasets_and_models",children:"public research resources"})," that support MEDS!"]}),"\n",(0,i.jsxs)(t.li,{children:["If you're looking to help build a shared understanding of the science of health AI, check out the\n",(0,i.jsx)(t.a,{href:"https://github.com/mmcdermott/MEDS-DEV",children:"MEDS-DEV"})," repository and see how you can contribute!"]}),"\n",(0,i.jsxs)(t.li,{children:["If you're looking to read academic papers about MEDS, check out\n",(0,i.jsx)(t.a,{href:"https://openreview.net/forum?id=IsHy2ebjIG",children:"our workshop paper"}),"!"]}),"\n",(0,i.jsxs)(t.li,{children:["Finally, if you have a question or comment not covered here, feel free to file an issue on the\n",(0,i.jsx)(t.a,{href:"https://github.com/Medical-Event-Data-Standard/meds",children:"MEDS GitHub repository"}),"!"]}),"\n"]})]})}function h(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,t,o)=>{o.d(t,{R:()=>r,x:()=>a});var n=o(6540);const i={},s=n.createContext(i);function r(e){const t=n.useContext(s);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),n.createElement(s.Provider,{value:t},e.children)}}}]);