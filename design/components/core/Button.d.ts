import * as React from 'react';
/**
 * Primary action button. Amber primary, translucent "glass", or borderless "ghost".
 * Shrinks to scale(.95) on :active. Use primary for the single main action per view.
 * @startingPoint section="Core" subtitle="Amber primary / glass / ghost button" viewport="700x130"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
