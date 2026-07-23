// @vitest-environment jsdom
import type { MediaItem } from '@kroma/core';
import { I18nProvider } from '@kroma/ui';
import { onScreen } from '@kroma/ui/testing';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EpisodeRow } from './EpisodeRow';

const episode = {
  id: 'ep1',
  title: 'Pilot',
  episodeTitle: 'Pilot',
  episode: 1,
  durationMs: 45 * 60_000,
  metadata: { overview: 'Jack wakes in the jungle and finds the other survivors.' },
} as unknown as MediaItem;

function row(over: { watched?: boolean; onToggleWatched?: () => void; item?: MediaItem } = {}) {
  return render(
    onScreen(
      <I18nProvider locale="en">
        <EpisodeRow
          episode={over.item ?? episode}
          still={null}
          watched={over.watched ?? false}
          progress={null}
          onPlay={() => undefined}
          onToggleWatched={over.onToggleWatched ?? (() => undefined)}
        />
      </I18nProvider>,
    ),
  );
}

afterEach(cleanup);

describe('EpisodeRow', () => {
  it('shows the recap next to the still', () => {
    row();
    expect(screen.getByText('1. Pilot')).toBeTruthy();
    expect(screen.getByText(/Jack wakes in the jungle/)).toBeTruthy();
    expect(screen.getByText('45min')).toBeTruthy();
  });

  it('offers a watched toggle beside the play target, so one episode can be marked alone', () => {
    const onToggleWatched = vi.fn();
    row({ onToggleWatched });
    // Two focus stops: the card (plays) and the toggle (marks it seen).
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Mark as watched'));
    expect(onToggleWatched).toHaveBeenCalledTimes(1);
  });

  it('offers the reverse once the episode is watched', () => {
    row({ watched: true });
    expect(screen.getByLabelText('Mark as unwatched')).toBeTruthy();
  });

  it('drops the recap line when the episode has no synopsis', () => {
    row({ item: { ...episode, metadata: null } as unknown as MediaItem });
    expect(screen.getByText('1. Pilot')).toBeTruthy();
    expect(screen.queryByText(/Jack wakes in the jungle/)).toBeNull();
  });
});
