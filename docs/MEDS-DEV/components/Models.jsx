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

import { load_MEDS_DEV, MODELS } from '@site/src/MEDS-DEV/load.js';
import Model from './Model';
import EntityPage from './EntityPage';


export default function Datasets() {
  return (
    <EntityPage
      target={MODELS}
      Entity={Model}
    />
  );
}
