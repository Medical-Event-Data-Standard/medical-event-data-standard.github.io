import React, { useState } from 'react';
import {
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Markdown from 'react-markdown';
import GitHubAvatar from '../GitHubAvatar';

import { Contact } from '@site/src/lib/MEDS-DEV/types';

interface HeaderProps {
  title: string;
  subtitle?: string | null;
  abstract?: string | null;
}

export const HeaderBlock: React.FC<HeaderProps> = ({ title, subtitle, abstract }) => (
  <Box mb={3}>
    <Typography variant="h3">{title}</Typography>
    {subtitle && (
      <Typography variant="subtitle1" color="textSecondary">
        {subtitle}
      </Typography>
    )}
    {abstract && (
      <Typography variant="body1" sx={{ mt: 2 }}>
        {abstract}
      </Typography>
    )}
    <Divider sx={{ my: 3 }} />
  </Box>
);

export const ReadmeBlock: React.FC<{ content: string | null }> = ({ content }) =>
  content && (
    <Box mb={3}>
      <Markdown>{content}</Markdown>
    </Box>
  );

export const ContactsBlock: React.FC<{ contacts?: Contact[] }> = ({ contacts }) =>
  contacts &&
  contacts.length > 0 && (
    <Box mb={3}>
      <Typography variant="h5">Contacts</Typography>
      {contacts.map((c, i) => (
        <GitHubAvatar key={i} name={c.name} github_username={c.github_username} />
      ))}
    </Box>
  );

export const LinksBlock: React.FC<{ links?: string[] }> = ({ links }) =>
  links &&
  links.length > 0 && (
    <Box mb={3}>
      <Typography variant="h5">External Links</Typography>
      <ul>
        {links.map((url, i) => (
          <li key={i}>
            <Link href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </Link>
          </li>
        ))}
      </ul>
    </Box>
  );

export function CitationBlock({ refs }: { refs: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>Citation (BibTeX)</Typography>
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
  );
}

export function InstallBlock({ requirements }: { requirements: string[] }): React.JSX.Element {
  // TODO: Add copy button

  return (
    <Box mb={3}>
      <Typography variant="h5">Pip Requirements</Typography>
      <Box component="pre" sx={{ backgroundColor: '#f5f5f5', p: 2, overflowX: 'auto' }}>
        {requirements.map((req, i) => (
          <Typography key={i} variant="body2">
            {req}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
