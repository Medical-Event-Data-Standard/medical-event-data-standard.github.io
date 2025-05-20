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

import { load_MEDS_DEV, MODELS } from '@site/src/lib/load';
import Model from './Model';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';


export default function Datasets() {
  return (
    <EntityPage
      target={MODELS}
      Entity={Model}
    />
  );
}
