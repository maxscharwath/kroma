import * as React from 'react';
/** Rounded pill for language codes (FR/EN/VOSTFR), audio formats (5.1/Atmos) and filters. */
export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  children?: React.ReactNode;
}
export function Chip(props: ChipProps): JSX.Element;
