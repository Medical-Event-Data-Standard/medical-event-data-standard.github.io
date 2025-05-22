import React from 'react';
import PackageTable from './PackageTable';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DynamicIcon from '@site/src/components/DynamicIcon';
import { RawCategory, Category } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';

function CategoryView({ name, category }: { name: string; category: Category }): React.JSX.Element {
  const { title, description, icon } = category;

  let displayData: React.JSX.Element | null = null;

  if ('packages' in category && category.packages && category.packages.length > 0) {
    displayData = <PackageTable packages={category.packages} />;
  } else if (
    'subcategories' in category &&
    category.subcategories &&
    Object.keys(category.subcategories).length > 0
  ) {
    displayData = (
      <div>
        {Object.entries(category.subcategories).map(([subName, subcategory]) => (
          <CategoryView name={subName} category={subcategory} key={subName} />
        ))}
      </div>
    );
  } else {
    displayData = null;
  }

  return (
    <Accordion defaultExpanded slotProps={{ heading: { component: 'h4' } }} sx={{ padding: 1 }} elevation={2}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${name}-content`}
        id={`${name}-header`}
      >
        <Typography variant="h4">
          {icon && <DynamicIcon iconName={icon} sx={{ mr: 1 }} />}
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {description && <Typography variant="subtitle1">{description}</Typography>}
        {displayData}
      </AccordionDetails>
    </Accordion>
  );
}

export default function Ecosystem({ data }: { data: Record<string, RawCategory> }): React.JSX.Element {
  const parsedCategories = parseCategoryMap(data);

  return (
    <div>
      {Object.entries(parsedCategories).map(([name, category]) => (
        <CategoryView name={name} category={category} key={name} />
      ))}
    </div>
  );
}
