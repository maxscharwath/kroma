// @vitest-environment jsdom
//
// The gallery renders every primitive in every state the design defines, so
// mounting it is the broadest smoke test the kit has: one render exercises the
// whole surface, and a component that throws on any of its states fails here
// rather than on a TV.
//
// It is deliberately assertion-light about pixels (that is what the screenshots
// are for) and heavy about presence: each section must be there, and the
// component counts must match what the design says the gallery shows.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../lib/glyph';
import { clearPressGuard } from '../lib/press-guard';
import { colors } from '../lib/tokens';
import { Gallery } from './gallery';

afterEach(() => {
  cleanup();
  clearPressGuard();
});

const SECTIONS = [
  'Typography',
  'Colour',
  'Buttons',
  'Chips and badges',
  'Focus',
  'Fields',
  'Progress and loading',
  'Identity',
  'Media',
  'States',
  'Icons',
];

describe('the design-system gallery', () => {
  it('mounts every primitive without throwing', () => {
    const { container } = render(<Gallery />);
    expect(container.querySelectorAll('*').length).toBeGreaterThan(400);
  });

  it('shows every section', () => {
    render(<Gallery />);
    // The eyebrow is uppercased by `text-transform`, so the DOM keeps the
    // original casing; asserting on that is what the reader actually wrote.
    for (const title of SECTIONS) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('draws one swatch per palette token', () => {
    render(<Gallery />);
    // getAllByText: a few token names ("text", "border") also appear as labels
    // elsewhere on the page, and the swatch only has to be one of them.
    for (const token of Object.keys(colors)) {
      expect(screen.getAllByText(token).length).toBeGreaterThan(0);
    }
  });

  it('draws every icon in the generated set', () => {
    const { container } = render(<Gallery />);
    for (const name of ICON_NAMES) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    // Every glyph is an <svg>, plus the ones the other sections use.
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(ICON_NAMES.length);
  });

  it('opens and closes the dialog', () => {
    render(<Gallery />);
    expect(screen.queryByText('Supprimer ce profil ?')).toBeNull();
    fireEvent.click(screen.getByLabelText('Ouvrir une boîte de dialogue'));
    expect(screen.getByText('Supprimer ce profil ?')).toBeTruthy();
    // Opening the dialog arms the OK guard (the press that opened it must not
    // also fire the control it auto-focuses), so a test that presses again
    // immediately has to step past it, exactly as a viewer does by taking
    // 300ms to reach for the next button.
    clearPressGuard();
    fireEvent.click(screen.getByLabelText('Annuler'));
    expect(screen.queryByText('Supprimer ce profil ?')).toBeNull();
  });

  it('moves the active chip on press', () => {
    render(<Gallery />);
    const sortie = screen.getByLabelText('Sortie');
    expect(getComputedStyle(sortie).backgroundColor).not.toBe('rgb(244, 182, 66)');
    clearPressGuard();
    fireEvent.click(sortie);
    expect(getComputedStyle(sortie).backgroundColor).toBe('rgb(244, 182, 66)');
  });
});
