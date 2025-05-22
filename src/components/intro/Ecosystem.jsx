import React, { useEffect, useState } from 'react';
import PackageTable from './PackageTable';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Paper from '@mui/material/Paper';
import DynamicIcon from '@site/src/components/DynamicIcon';

export default function Ecosystem({ data }) {
  return (
    <div>
      {Object.entries(data).map(([categoryKey, categoryData]) => (
        <div style={{ margin: '20px 0' }} key={categoryKey}>
          <Accordion
            defaultExpanded
            slotProps={{ heading: { component: 'h4' } }}
            sx={{ padding: 1 }}
            key={categoryKey}
            elevation={2}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${categoryKey}-content`}
              id={`${categoryKey}-header`}
            >
              <Typography variant="h4">
                {categoryData.icon && <DynamicIcon iconName={categoryData.icon} sx={{ mr: 1 }} />}
                {categoryData.title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1">{categoryData.description}</Typography>
              {Object.entries(categoryData).map(([subKey, subData]) => {
                if (subData.packages) {
                  return (
                    <Paper key={subKey} elevation={3} sx={{ padding: 2, margin: 2 }}>
                      <Typography variant="h5">{subData.title}</Typography>
                      <Typography variant="subtitle2">{subData.description}</Typography>
                      <PackageTable packages={subData.packages} />
                    </Paper>
                  );
                }
                return null;
              })}

              {categoryData.packages && <PackageTable packages={categoryData.packages} />}
            </AccordionDetails>
          </Accordion>
        </div>
      ))}
    </div>
  );
}
