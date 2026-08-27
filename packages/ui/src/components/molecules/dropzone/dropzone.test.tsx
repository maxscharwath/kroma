// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone, sift } from './dropzone.web';

const file = (name: string, size: number, type = '') => {
  const made = new File(['x'], name, { type });
  Object.defineProperty(made, 'size', { value: size });
  return made;
};

describe('what a zone takes and what it turns away', () => {
  it('turns away a file bigger than the ceiling, and says which rule it broke', () => {
    const { taken, turned } = sift([file('big.torrent', 2000)], { maxSize: 1000 });

    expect(taken).toEqual([]);
    expect(turned).toEqual([
      { file: expect.objectContaining({ name: 'big.torrent' }), reason: 'size' },
    ]);
  });

  it('matches an extension rule the way the native picker does', () => {
    const { taken, turned } = sift([file('a.torrent', 10), file('b.png', 10)], {
      accept: '.torrent',
    });

    expect(taken.map((f) => f.name)).toEqual(['a.torrent']);
    expect(turned[0]).toMatchObject({ reason: 'type' });
  });

  it('matches a type family', () => {
    const { taken } = sift([file('a.png', 10, 'image/png')], { accept: 'image/*', multiple: true });

    expect(taken).toHaveLength(1);
  });

  it('takes only the first when the zone is not multiple, without calling the rest rejected', () => {
    const { taken, turned } = sift([file('a.torrent', 10), file('b.torrent', 10)], {});

    expect(taken.map((f) => f.name)).toEqual(['a.torrent']);
    expect(turned).toEqual([]);
  });

  it('takes everything when nothing narrows it', () => {
    const { taken } = sift([file('a', 1), file('b', 1)], { multiple: true });

    expect(taken).toHaveLength(2);
  });
});

describe('the surface', () => {
  it('hands over what was dropped on it', () => {
    const onDrop = vi.fn();
    render(
      <Dropzone.Root label="Upload" accept=".torrent" onDrop={onDrop}>
        <Dropzone.Title>Drop it</Dropzone.Title>
      </Dropzone.Root>,
    );

    fireEvent.drop(screen.getByRole('button'), {
      dataTransfer: { files: [file('a.torrent', 10)] },
    });

    expect(onDrop).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.torrent' })]);
  });

  it('reports what it turned away rather than swallowing it', () => {
    const onDrop = vi.fn();
    const onReject = vi.fn();
    render(
      <Dropzone.Root label="Upload" maxSize={100} onDrop={onDrop} onReject={onReject}>
        <Dropzone.Title>Drop it</Dropzone.Title>
      </Dropzone.Root>,
    );

    fireEvent.drop(screen.getByRole('button'), {
      dataTransfer: { files: [file('big.torrent', 900)] },
    });

    expect(onDrop).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith([expect.objectContaining({ reason: 'size' })]);
  });

  it('takes nothing while it is busy', () => {
    const onDrop = vi.fn();
    render(
      <Dropzone.Root label="Upload" loading onDrop={onDrop}>
        <Dropzone.Title>Drop it</Dropzone.Title>
      </Dropzone.Root>,
    );

    fireEvent.drop(screen.getByRole('button'), {
      dataTransfer: { files: [file('a.torrent', 10)] },
    });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it('highlights while a file is over it, and stops when it leaves', () => {
    render(
      <Dropzone.Root label="Upload">
        <Dropzone.Title>Drop it</Dropzone.Title>
      </Dropzone.Root>,
    );
    const zone = screen.getByRole('button');

    fireEvent.dragOver(zone);
    expect(zone.getAttribute('data-drag-active')).not.toBeNull();

    fireEvent.dragLeave(zone);
    expect(zone.getAttribute('data-drag-active')).toBeNull();
  });

  it('is a real button, so picking a file never needs a pointer', () => {
    render(
      <Dropzone.Root label="Upload">
        <Dropzone.Title>Drop it</Dropzone.Title>
      </Dropzone.Root>,
    );

    // A <button> is a focus stop and an Enter/Space target already; a div with
    // role=button would have had to reimplement both.
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });

  it('keeps the picker out of the tab order, so the surface is the only stop', () => {
    const { container } = render(
      <Dropzone.Root label="Upload">
        <Dropzone.Title>Drop it</Dropzone.Title>
      </Dropzone.Root>,
    );

    expect(container.querySelector('input')?.getAttribute('tabindex')).toBe('-1');
  });
});
