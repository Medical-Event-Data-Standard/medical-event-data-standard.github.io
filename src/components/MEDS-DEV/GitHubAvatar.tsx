import Link from '@docusaurus/Link';
import { Chip } from '@mui/material';
import Avatar from '@mui/material/Avatar';

interface GitHubAvatarProps {
  name: string;
  github_username: string;
}

export default function GitHubAvatar({ name, github_username }: GitHubAvatarProps): React.JSX.Element {
  const profileUrl = `https://github.com/${github_username}`;
  const avatarUrl = `${profileUrl}.png?size=256`;

  // Docusaurus' Link opens external URLs in a new tab with `rel="noopener noreferrer"`.
  return (
    <Chip
      avatar={<Avatar alt={name} src={avatarUrl} />}
      label={`${name} (${github_username})`}
      sx={{ mr: 1, mb: 1 }}
      component={Link}
      href={profileUrl}
      clickable
    />
  );
}
