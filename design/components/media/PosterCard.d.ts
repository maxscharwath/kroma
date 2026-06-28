import * as React from 'react';
/**
 * Poster tile used throughout LUMA rails and grids. Background is generated key-art (two-stop gradient).
 * @startingPoint section="Media" subtitle="Poster tile with key-art, badge and progress" viewport="700x340"
 */
export interface PosterCardProps {
  title: string;
  genre?: string;
  badge?: string;
  colors?: [string, string];
  progress?: number | null;
  width?: number;
  onClick?: () => void;
}
export function PosterCard(props: PosterCardProps): JSX.Element;
