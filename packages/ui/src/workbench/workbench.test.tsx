import type { ReactElement } from 'react';
// @vitest-environment jsdom
//
// The workbench rendered for real, through react-native-web, because the claim
// worth checking is not that the data is right (story.test.ts covers that) but
// that a design system's own components can host the tool that inspects them.

import { cleanup, fireEvent, render as renderRaw, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { onScreen } from '../testing';
import { matches } from './sidebar';
import { type Story, slug } from './story';
import { Workbench } from './workbench';

/** Every kit control is a node of the spatial navigator, and a node needs a
 * navigator - the router gives every screen one. A test renders inside the same
 * scope so the tree it mounts is the tree the app mounts. */
const render = (ui: ReactElement) => renderRaw(onScreen(ui));

afterEach(cleanup);

describe('<Workbench />', () => {
  it('lists the stories grouped, and opens the first one', () => {
    render(<Workbench />);
    expect(screen.getAllByText('Fondations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Couleurs').length).toBeGreaterThan(0);
    // The first story of the first group is what a cold open lands on.
    expect(screen.getAllByText('Aperçu').length).toBe(1);
  });

  it('switches story when a sidebar entry is pressed', () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Button' }));
    // The header now names the selected component, alongside its sidebar entry.
    expect(screen.getAllByText('Button').length).toBeGreaterThan(1);
    // ...and the panel shows the controls derived from the component's own `sv`.
    expect(screen.getByText('Variantes')).toBeTruthy();
    expect(screen.getByText('variant')).toBeTruthy();
  });

  it('renders one matrix row per variant group', () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Button' }));
    fireEvent.click(screen.getByRole('button', { name: 'Matrice' }));
    // Button declares variant / active / size / block; each becomes a labelled
    // row, and each row holds one cell per option.
    expect(screen.getAllByText('primary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('danger').length).toBeGreaterThan(0);
    expect(screen.getAllByText('size').length).toBeGreaterThan(0);
  });

  it('filters the sidebar as you search', () => {
    render(<Workbench />);
    fireEvent.change(screen.getByLabelText('Rechercher un composant'), {
      target: { value: 'prog' },
    });
    expect(screen.getAllByText('Progress').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Couleurs' })).toBeNull();
  });
});

describe('sidebar filtering', () => {
  const story = (name: string, group: string) => ({ name, group, id: slug(name) }) as Story;

  it('matches on the name or the section', () => {
    expect(matches(story('Button', 'Actions'), 'but')).toBe(true);
    expect(matches(story('Button', 'Actions'), 'act')).toBe(true);
    expect(matches(story('Button', 'Actions'), 'wheel')).toBe(false);
    expect(matches(story('Button', 'Actions'), '')).toBe(true);
  });
});
