
import { Chip } from '@mui/material';
import Avatar from '@mui/material/Avatar';

export default function GitHubAvatar({ name, github_username }) {
  const profileUrl = `https://github.com/${github_username}`;
  const avatarUrl = `${profileUrl}.png?size=256`;

  return (
    <Chip
      avatar={<Avatar alt={name} src={avatarUrl} />}
      label={`${name} (${github_username})`}
      sx={{ mr: 1, mb: 1 }}
      component="a"
      href={profileUrl}
      target="_blank"
      clickable
    />
  );
}
