import React from 'react';
import { Grid, Card, CardHeader, CardMedia, CardContent, Typography } from '@mui/material';

export function TutorialPresenter({
  name,
  affiliation,
  bio,
  url,
  photoUrl,
}: {
  name: string;
  affiliation: string;
  bio?: string;
  url: string;
  photoUrl: string;
}): React.JSX.Element {
  const title: React.JSX.Element = url ? <a href={url}>{name}</a> : <span>{name}</span>;
  return (
    <Card style={{ margin: '2em', maxWidth: '300px' }}>
      <CardMedia
        component="img"
        image={photoUrl}
        alt={`${name}'s photo`}
        // Make the image square
        sx={{ objectFit: 'cover', width: '100%', height: '250px' }}
      />
      <CardHeader
        title={title}
        subheader={affiliation}
        //avatar={<Avatar src={photoUrl} alt={name} sx={{width: "3em", height: "3em"}}/>}
      />
      {bio && (
        <CardContent>
          <Typography>{bio}</Typography>
        </CardContent>
      )}
    </Card>
  );
}

export function TutorialPresenters({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Grid container spacing={1} sx={{ padding: '16px', justifyContent: 'center' }}>
      {React.Children.map(children, child => (
        <Grid size={{ xs: 10, sm: 6, md: 6, lg: 5, xl: 4 }}>{child}</Grid>
      ))}
    </Grid>
  );
}
