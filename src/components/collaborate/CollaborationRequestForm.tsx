import React, { useId, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { buildIssueUrl } from '@site/src/lib/collaborate/buildIssueUrl';
import {
  CollaborationDraft,
  EMPTY_DRAFT,
  FIELD_LIMITS,
  GOAL_LABELS,
  GOALS,
  ROLE_LABELS,
  ROLES,
  validateDraft,
} from '@site/src/lib/collaborate/request';

type Field = keyof CollaborationDraft;
// Fields in on-screen order, so focus moves to the first invalid one.
const FIELDS: Field[] = ['role', 'name', 'link', 'goal', 'message'];

/** Collects a collaboration request and opens it as a pre-filled MEDS-DEV GitHub issue in a new tab. */
export default function CollaborationRequestForm(): React.JSX.Element {
  const [draft, setDraft] = useState<CollaborationDraft>(EMPTY_DRAFT);
  const [attempted, setAttempted] = useState(false);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const id = useId();
  const refs: Record<Field, React.RefObject<HTMLElement | null>> = {
    role: useRef<HTMLInputElement>(null),
    name: useRef<HTMLInputElement>(null),
    link: useRef<HTMLInputElement>(null),
    goal: useRef<HTMLSelectElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };

  const { errors, request } = validateDraft(draft);
  // Errors only appear after the first submit attempt, then update as the user types.
  const shown = attempted ? errors : {};

  const update =
    (field: Field) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
      setDraft(current => ({ ...current, [field]: event.target.value }));
      setIssueUrl(null);
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setAttempted(true);
    if (!request) {
      const firstInvalid = FIELDS.find(field => errors[field]) as Field;
      (refs[firstInvalid].current as HTMLElement).focus();
      return;
    }
    const url = buildIssueUrl(request, { sourceUrl: window.location.origin + window.location.pathname });
    window.open(url, '_blank', 'noopener,noreferrer');
    setIssueUrl(url);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          component="form"
          noValidate
          onSubmit={handleSubmit}
          spacing={3}
          aria-label="Collaboration request"
        >
          <Typography variant="body2" color="text.secondary">
            Fields marked * are required.
          </Typography>

          <FormControl component="fieldset" required error={Boolean(shown.role)}>
            <FormLabel component="legend">I am a…</FormLabel>
            <RadioGroup
              row
              name="role"
              value={draft.role}
              onChange={update('role')}
              aria-required="true"
              aria-invalid={Boolean(shown.role)}
              aria-describedby={shown.role ? `${id}-role-error` : undefined}
            >
              {ROLES.map((role, index) => (
                <FormControlLabel
                  key={role}
                  value={role}
                  control={<Radio inputRef={index === 0 ? refs.role : undefined} />}
                  label={ROLE_LABELS[role]}
                />
              ))}
            </RadioGroup>
            {shown.role && <FormHelperText id={`${id}-role-error`}>{shown.role}</FormHelperText>}
          </FormControl>

          <TextField
            id={`${id}-name`}
            name="name"
            label="Name of your dataset, task or model"
            required
            fullWidth
            value={draft.name}
            onChange={update('name')}
            inputRef={refs.name}
            error={Boolean(shown.name)}
            helperText={shown.name ?? 'For example, MIMIC-IV, an in-ICU mortality task, or MEDS-Tab.'}
            slotProps={{ htmlInput: { maxLength: FIELD_LIMITS.name } }}
          />

          <TextField
            id={`${id}-link`}
            name="link"
            label="Link"
            type="url"
            fullWidth
            value={draft.link}
            onChange={update('link')}
            inputRef={refs.link}
            error={Boolean(shown.link)}
            helperText={shown.link ?? 'Optional: a repository, paper or PhysioNet page, for example.'}
            slotProps={{ htmlInput: { maxLength: FIELD_LIMITS.link, inputMode: 'url' } }}
          />

          <TextField
            id={`${id}-goal`}
            name="goal"
            label="What would you like to do?"
            select
            required
            fullWidth
            value={draft.goal}
            onChange={update('goal')}
            inputRef={refs.goal}
            error={Boolean(shown.goal)}
            helperText={shown.goal}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="" disabled>
              Choose an option
            </option>
            {GOALS.map(goal => (
              <option key={goal} value={goal}>
                {GOAL_LABELS[goal]}
              </option>
            ))}
          </TextField>

          <TextField
            id={`${id}-message`}
            name="message"
            label="Short message"
            multiline
            minRows={4}
            fullWidth
            value={draft.message}
            onChange={update('message')}
            inputRef={refs.message}
            helperText={`Optional. ${draft.message.length}/${FIELD_LIMITS.message} characters.`}
            slotProps={{ htmlInput: { maxLength: FIELD_LIMITS.message } }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
            <Button
              type="submit"
              variant="contained"
              endIcon={<OpenInNewIcon />}
              aria-describedby={`${id}-submit-note`}
              sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              Open request on GitHub
            </Button>
            <Typography id={`${id}-submit-note`} variant="body2" color="text.secondary">
              This opens a pre-filled issue on the public MEDS-DEV GitHub repository in a new tab, where you
              can review and post it. You need a GitHub account. Everything you enter will be public, so do
              not include patient data or confidential information.
            </Typography>
          </Stack>

          {issueUrl && (
            <Alert severity="info" role="status">
              Your request opened in a new tab: post it there to send it. If no tab opened,{' '}
              <Link href={issueUrl} target="_blank" rel="noopener noreferrer">
                open the pre-filled issue
              </Link>
              .
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
