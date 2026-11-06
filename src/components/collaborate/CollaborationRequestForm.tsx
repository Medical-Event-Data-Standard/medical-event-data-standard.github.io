import React, { useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { buildEmailText, buildIssueUrl, buildMailtoUrl } from '@site/src/lib/collaborate/buildIssueUrl';
import { navigateTo } from '@site/src/lib/collaborate/navigate';
import {
  asksForModalities,
  COLLABORATION_EMAIL,
  CollaborationDraft,
  CollaborationRequest,
  EMPTY_DRAFT,
  FIELD_LIMITS,
  Goal,
  GOAL_LABELS,
  goalsForRoles,
  MODALITIES,
  Modality,
  MODALITY_LABELS,
  Role,
  ROLE_LABELS,
  ROLES,
  validateDraft,
  withRoles,
} from '@site/src/lib/collaborate/request';

// The fields that can be invalid, in on-screen order, so focus moves to the first invalid one.
const VALIDATED_FIELDS = ['roles', 'name', 'link', 'goal'] as const;
type ValidatedField = (typeof VALIDATED_FIELDS)[number];

/** What the form tells the user after they used one of its actions. */
type Notice =
  | { kind: 'issue'; url: string }
  | { kind: 'email' }
  | { kind: 'copied' }
  | { kind: 'copy-failed'; text: string };

/** Adds `option` to `list` or removes it from `list`. */
function toggled<T>(list: T[], option: T, checked: boolean): T[] {
  return checked ? [...list, option] : list.filter(item => item !== option);
}

export interface CollaborationRequestFormProps {
  /** The address "Send by email" writes to; the email option is hidden while this is empty. */
  email?: string;
}

/**
 * Collects a collaboration request and opens it as a pre-filled MEDS-DEV GitHub issue in a new tab or, when
 * `email` is set, as a pre-filled email in the visitor's mail app.
 */
export default function CollaborationRequestForm({
  email = COLLABORATION_EMAIL,
}: CollaborationRequestFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<CollaborationDraft>(EMPTY_DRAFT);
  const [attempted, setAttempted] = useState(false);
  const [goalCleared, setGoalCleared] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const id = useId();
  const firstRole = useRef<HTMLInputElement>(null);
  const refs: Record<ValidatedField, React.RefObject<HTMLElement | null>> = {
    roles: firstRole,
    name: useRef<HTMLInputElement>(null),
    link: useRef<HTMLInputElement>(null),
    goal: useRef<HTMLSelectElement>(null),
  };

  const { errors, request } = validateDraft(draft);
  // Errors only appear after the first submit attempt, then update as the user types.
  const shown = attempted ? errors : {};
  const noRole = draft.roles.length === 0;
  const goalHelp = noRole
    ? 'Choose who you are first.'
    : (shown.goal ??
      (goalCleared ? 'Your earlier choice does not fit who you are, so choose again.' : undefined));

  const change = (next: CollaborationDraft): void => {
    setDraft(next);
    // Any edit makes the links in a notice out of date.
    setNotice(null);
  };

  const toggleRole =
    (role: Role) =>
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const next = withRoles(draft, toggled(draft.roles, role, event.target.checked));
      // withRoles only changes the goal to clear it; say so, so the reset select does not go unnoticed.
      if (next.goal !== draft.goal) setGoalCleared(true);
      change(next);
    };

  const toggleModality =
    (modality: Modality) =>
    (event: React.ChangeEvent<HTMLInputElement>): void =>
      change({ ...draft, modalities: toggled(draft.modalities, modality, event.target.checked) });

  const updateText =
    (field: 'name' | 'link' | 'message') =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
      change({ ...draft, [field]: event.target.value });

  const updateGoal = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setGoalCleared(false);
    change({ ...draft, goal: event.target.value as Goal });
  };

  /** Shows any errors and focuses the first invalid field; every action goes through this first. */
  const validated = (): CollaborationRequest | null => {
    setAttempted(true);
    if (!request) {
      const firstInvalid = VALIDATED_FIELDS.find(field => errors[field]) as ValidatedField;
      (refs[firstInvalid].current as HTMLElement).focus();
    }
    return request;
  };
  const sourceUrl = (): string => window.location.origin + window.location.pathname;

  const openIssue = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const valid = validated();
    if (!valid) return;
    const url = buildIssueUrl(valid, { sourceUrl: sourceUrl() });
    window.open(url, '_blank', 'noopener,noreferrer');
    setNotice({ kind: 'issue', url });
  };

  const sendEmail = (): void => {
    const valid = validated();
    if (!valid) return;
    navigateTo(buildMailtoUrl(valid, { to: email, sourceUrl: sourceUrl() }));
    setNotice({ kind: 'email' });
  };

  const copyRequest = async (): Promise<void> => {
    const valid = validated();
    if (!valid) return;
    const text = buildEmailText(valid, { to: email, sourceUrl: sourceUrl() });
    try {
      // Throws if the browser has no clipboard API, for example on a page that is not served over HTTPS.
      await navigator.clipboard.writeText(text);
      setNotice({ kind: 'copied' });
    } catch {
      setNotice({ kind: 'copy-failed', text });
    }
  };

  // Side by side, both action buttons take the width of the wider one; on phones they keep their own width.
  const actionButton = { justifySelf: { xs: 'start', sm: 'stretch' } };
  // A checkbox group has no outline, so its hint lines up with the legend instead of being indented.
  const checkboxHelp = { mx: 0 };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          component="form"
          noValidate
          onSubmit={openIssue}
          spacing={3}
          aria-label="Collaboration request"
        >
          <Typography variant="body2" color="text.secondary">
            Fields marked * are required.
          </Typography>

          <FormControl
            component="fieldset"
            required
            error={Boolean(shown.roles)}
            aria-describedby={`${id}-roles-help`}
          >
            <FormLabel component="legend">I am a…</FormLabel>
            <FormGroup row>
              {ROLES.map((role, index) => (
                <FormControlLabel
                  key={role}
                  label={ROLE_LABELS[role]}
                  control={
                    <Checkbox
                      name="roles"
                      value={role}
                      checked={draft.roles.includes(role)}
                      onChange={toggleRole(role)}
                      slotProps={{
                        input: {
                          ref: index === 0 ? firstRole : undefined,
                          'aria-invalid': Boolean(shown.roles),
                        },
                      }}
                    />
                  }
                />
              ))}
            </FormGroup>
            <FormHelperText id={`${id}-roles-help`} sx={checkboxHelp}>
              {shown.roles ?? 'Choose one or more.'}
            </FormHelperText>
          </FormControl>

          <TextField
            id={`${id}-name`}
            name="name"
            label="Name of your dataset, task or model"
            required
            fullWidth
            value={draft.name}
            onChange={updateText('name')}
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
            onChange={updateText('link')}
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
            disabled={noRole}
            value={draft.goal}
            onChange={updateGoal}
            inputRef={refs.goal}
            error={!noRole && Boolean(shown.goal)}
            helperText={goalHelp}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="" disabled>
              Choose an option
            </option>
            {goalsForRoles(draft.roles).map(goal => (
              <option key={goal} value={goal}>
                {GOAL_LABELS[goal]}
              </option>
            ))}
          </TextField>

          {asksForModalities(draft.roles) && (
            <FormControl component="fieldset" aria-describedby={`${id}-modalities-help`}>
              <FormLabel component="legend">What kinds of data are involved?</FormLabel>
              <FormGroup
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 2 }}
              >
                {MODALITIES.map(modality => (
                  <FormControlLabel
                    key={modality}
                    label={MODALITY_LABELS[modality]}
                    control={
                      <Checkbox
                        name="modalities"
                        value={modality}
                        checked={draft.modalities.includes(modality)}
                        onChange={toggleModality(modality)}
                      />
                    }
                  />
                ))}
              </FormGroup>
              <FormHelperText id={`${id}-modalities-help`} sx={checkboxHelp}>
                Optional. Tick everything your dataset contains or your model uses.
              </FormHelperText>
            </FormControl>
          )}

          <TextField
            id={`${id}-message`}
            name="message"
            label="Short message"
            multiline
            minRows={4}
            fullWidth
            value={draft.message}
            onChange={updateText('message')}
            helperText={`Optional. ${draft.message.length}/${FIELD_LIMITS.message} characters.`}
            slotProps={{ htmlInput: { maxLength: FIELD_LIMITS.message } }}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
              columnGap: 2,
              rowGap: 1.5,
              alignItems: 'center',
            }}
          >
            <Button
              type="submit"
              variant="contained"
              endIcon={<OpenInNewIcon />}
              aria-describedby={`${id}-issue-note`}
              sx={actionButton}
            >
              Open request on GitHub
            </Button>
            <Typography id={`${id}-issue-note`} variant="body2" color="text.secondary">
              <strong>Public.</strong> This opens a pre-filled issue on the public MEDS-DEV GitHub repository
              in a new tab, where you can review and post it. You need a GitHub account. Everyone can read the
              issue, so do not include patient data or confidential information.
            </Typography>

            {email && (
              <>
                <Button
                  type="button"
                  variant="outlined"
                  endIcon={<MailOutlineIcon />}
                  onClick={sendEmail}
                  aria-describedby={`${id}-email-note`}
                  sx={{ ...actionButton, mt: { xs: 1.5, sm: 0 } }}
                >
                  Send by email
                </Button>
                <Typography id={`${id}-email-note`} variant="body2" color="text.secondary">
                  <strong>Private.</strong> This opens a pre-filled email to the MEDS-DEV maintainers in your
                  mail app, where you can review and send it. Only the maintainers receive it, and you keep a
                  copy in your Sent folder. Do not include patient data.
                </Typography>
                <Button
                  type="button"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={copyRequest}
                  aria-describedby={`${id}-copy-note`}
                  sx={{ justifySelf: 'start' }}
                >
                  Copy request
                </Button>
                <Typography id={`${id}-copy-note`} variant="body2" color="text.secondary">
                  No mail app? Copy the request and paste it into an email to {email}.
                </Typography>
              </>
            )}
          </Box>

          {notice?.kind === 'issue' && (
            <Alert severity="info" role="status">
              Your request opened in a new tab: post it there to send it. If no tab opened,{' '}
              <Link href={notice.url} target="_blank" rel="noopener noreferrer">
                open the pre-filled issue
              </Link>
              .
            </Alert>
          )}
          {notice?.kind === 'email' && (
            <Alert severity="info" role="status">
              Your request should now be open in your mail app: send it from there. If nothing opened, use
              “Copy request” and paste it into an email to {email}.
            </Alert>
          )}
          {notice?.kind === 'copied' && (
            <Alert severity="success" role="status">
              Copied. Paste the request into a new email to {email}; its first two lines are the address and
              subject.
            </Alert>
          )}
          {notice?.kind === 'copy-failed' && (
            <Stack spacing={2}>
              <Alert severity="warning" role="status">
                Your browser did not let the page copy the request. Select the text below, copy it, and paste
                it into a new email to {email}.
              </Alert>
              <TextField
                label="Your request"
                multiline
                fullWidth
                value={notice.text}
                slotProps={{ htmlInput: { readOnly: true } }}
              />
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
