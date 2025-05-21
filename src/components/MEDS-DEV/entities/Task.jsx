import React, { useState } from 'react';
import {
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
import BenchmarkPlot from '../plots/BenchmarkPlot';
import Markdown from 'react-markdown';

function InfoBlock({ readme, metadata, refs }) {
  const [copied, setCopied] = useState(false);

  const { description = null, links = [], contacts = [] } = metadata || {};

  return (
    <Box mb={3}>
      {description && (
        <Typography variant="body1" gutterBottom>
          {description}
        </Typography>
      )}

      <Divider sx={{ my: 3 }} />

      {readme && (
        <Box mb={3}>
          <Markdown>{readme}</Markdown>
        </Box>
      )}

      {links.length > 0 && (
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Links
          </Typography>
          <ul>
            {links.map((l, i) => (
              <li key={i}>
                <Link href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label || l.url}
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      )}

      {contacts.length > 0 && (
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Contacts
          </Typography>
          {contacts.map((c, i) => (
            <Chip
              key={i}
              label={`${c.name} (${c.github})`}
              sx={{ mr: 1, mb: 1 }}
              component="a"
              href={`https://github.com/${c.github}`}
              target="_blank"
              clickable
            />
          ))}
        </Box>
      )}

      {refs && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Citation (BibTeX)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Paper variant="outlined" sx={{ p: 2, position: 'relative' }}>
              <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                <IconButton
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => {
                    navigator.clipboard.writeText(refs);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <ContentCopy />
                </IconButton>
              </Tooltip>
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {refs}
              </Box>
            </Paper>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

export default function Task({ name, data }) {
  const { readme, task, refs } = data;

  const { metadata } = task || {};

  return (
    <Box sx={{ maxWidth: 1000, margin: '0 auto' }}>
      <Typography variant="h3" gutterBottom>
        {name}
      </Typography>

      <InfoBlock readme={readme} metadata={metadata} refs={refs} />

      <Box mt={5}>
        <Typography variant="h5" gutterBottom>
          Benchmark Results
        </Typography>
        <BenchmarkPlot taskFilter={name} />
      </Box>
    </Box>
  );
}
