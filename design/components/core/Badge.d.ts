import * as React from 'react';
/** Quality (4K/HDR/H.265) or status (success/info/neutral) pill. Text only — never emoji. */
export interface BadgeProps {
  tone?: '4K' | 'HDR' | 'H.265' | 'success' | 'info' | 'neutral';
  children?: React.ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
