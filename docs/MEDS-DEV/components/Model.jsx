import React, { useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BenchmarkPlot from './BenchmarkPlot';
import Markdown from 'react-markdown';
import GitHubAvatar from './GitHubAvatar';

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
            <GitHubAvatar key={i} name={c.name} github_username={c.github_username} />
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

function TechnicalBlock({ requirements, commands }) {
  const { build_full = null, build_demo = null } = commands || {};

  const build_command = build_full || build_demo;

  return (
    <Box mb={3}>
      {(requirements || build_command) && (
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Install Instructions
          </Typography>
          {requirements && (
            <Box component="pre" sx={{ backgroundColor: '#f5f5f5', p: 2, overflowX: 'auto' }}>
              {requirements}
            </Box>
          )}
          {build_command && (
            <Box component="pre" sx={{ backgroundColor: '#f5f5f5', p: 2, overflowX: 'auto' }}>
              {build_command}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function Model({ name, data }) {
  const { readme, model, refs, requirements } = data.data;

  const { metadata, commands } = model || {};

  return (
    <Box sx={{ maxWidth: 1000, margin: '0 auto' }}>
      <Typography variant="h3" gutterBottom>
        {name}
      </Typography>

      <InfoBlock readme={readme} metadata={metadata} refs={refs} />

      <TechnicalBlock requirements={requirements} commands={commands} />

      <Box mt={5}>
        <Typography variant="h5" gutterBottom>
          Benchmark Results
        </Typography>
        <BenchmarkPlot modelFilter={name} />
      </Box>
    </Box>
  );
}
