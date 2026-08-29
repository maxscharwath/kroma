// @vitest-environment jsdom

import {
  NavigatorItem,
  NavigatorRoot,
  NavigatorView,
  type NodeHandle,
} from '@kroma/spatial-nav/react';
import { cleanup, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

// Asks in its own mount effect, which is the earliest a control can ask and
// the moment its ancestors are still unregistered: effects run child-first, so
// the view wrapping this tile registers after it does.
function EntryTile() {
  const entry = useRef<NodeHandle>(null);
  useEffect(() => {
    entry.current?.focus();
  }, []);
  return (
    <NavigatorItem ref={entry}>
      {({ focused }) => <View testID={focused ? 'lit' : 'dark'} />}
    </NavigatorItem>
  );
}

// The screen whose entry point arrives with its data: the view AND the tile
// under it mount together, in a commit the root itself does not take part in.
// That is the ONE shape that needs the queue, and the one the app is: the tile
// registers, asks, and is refused because its own parent has not registered
// yet; the parent registers a moment later; and nothing re-renders the root to
// go back for the ask.
function LateBranch() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return null;
  return (
    <NavigatorView direction="horizontal">
      <EntryTile />
    </NavigatorView>
  );
}

describe('focus asked for before the tree that holds it is whole', () => {
  it('lands when the whole screen mounts at once', () => {
    render(
      <NavigatorRoot>
        <NavigatorView direction="horizontal">
          <EntryTile />
        </NavigatorView>
      </NavigatorRoot>,
    );
    expect(screen.getByTestId('lit')).toBeTruthy();
  });

  it('lands when the branch holding it mounts whole, under a root that does not re-render', () => {
    render(
      <NavigatorRoot>
        <LateBranch />
      </NavigatorRoot>,
    );
    expect(screen.getByTestId('lit')).toBeTruthy();
  });

  it('lands when the tile itself arrives last', () => {
    function Later() {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        setReady(true);
      }, []);
      return ready ? <EntryTile /> : null;
    }
    render(
      <NavigatorRoot>
        <NavigatorView direction="horizontal">
          <Later />
        </NavigatorView>
      </NavigatorRoot>,
    );
    expect(screen.getByTestId('lit')).toBeTruthy();
  });
});
