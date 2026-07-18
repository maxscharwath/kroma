import { describe, expect, it } from 'vitest';
import { type RedirectRule, resolveRedirect } from './guard';

type Screen = 'setup' | 'login' | 'home' | 'player';
interface State {
  hasServer: boolean;
  authed: boolean;
}

const RULES: RedirectRule<State, Screen>[] = [
  { when: (s) => !s.hasServer, to: 'setup', allow: ['setup'] },
  { when: (s) => !s.authed, to: 'login', allow: ['login', 'setup'] },
];

describe('resolveRedirect', () => {
  it('returns null when the current screen is allowed under the first matching rule', () => {
    expect(resolveRedirect(RULES, { hasServer: false, authed: false }, 'setup')).toBeNull();
  });

  it('redirects to the rule target when the current screen is disallowed', () => {
    expect(resolveRedirect(RULES, { hasServer: false, authed: false }, 'home')).toBe('setup');
  });

  it('lets the first matching rule win over later ones', () => {
    // Both rules match (no server AND not authed) but the server rule comes first.
    expect(resolveRedirect(RULES, { hasServer: false, authed: false }, 'login')).toBe('setup');
  });

  it('falls through to a later rule when earlier rules do not apply', () => {
    expect(resolveRedirect(RULES, { hasServer: true, authed: false }, 'home')).toBe('login');
    // 'setup' is allowed by the login rule, so staying is fine.
    expect(resolveRedirect(RULES, { hasServer: true, authed: false }, 'setup')).toBeNull();
  });

  it('returns null when no rule governs the current state', () => {
    expect(resolveRedirect(RULES, { hasServer: true, authed: true }, 'player')).toBeNull();
  });

  it('returns null for an empty rule set', () => {
    expect(resolveRedirect([], { hasServer: false, authed: false }, 'home')).toBeNull();
  });
});
