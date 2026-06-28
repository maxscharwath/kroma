import * as React from 'react';
/** Gradient avatar disc with initials — used for profiles and the cast/distribution section. */
export interface AvatarProps {
  name?: string;
  size?: number;
  gradient?: string;
  radius?: string;
}
export function Avatar(props: AvatarProps): JSX.Element;
