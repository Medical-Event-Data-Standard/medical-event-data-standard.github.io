import React, { useEffect, useState } from 'react';
import {
  CircularProgress,
  Typography,
  Box,
  Paper,
  Link,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { load_MEDS_DEV, DATASETS } from '@site/src/lib/load';
import Dataset from './Dataset';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';


export default function Datasets() {
  return (
    <EntityPage
      target={DATASETS}
      Entity={Dataset}
    />
  );
}
