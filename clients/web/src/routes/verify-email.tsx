import { useT } from '@kroma/ui';
import { Box, Button, Logo, Text } from '@kroma/ui/kit';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Spinner } from '#web/features/accounts/auth-gate';
import { useAuth } from '#web/shared/lib/auth';
import { PAGE_RADIAL } from '#web/shared/ui';

// Public email-verification page. An admin mints a verification and the link
// arrives by email (or by hand); confirming proves the mailbox is reachable.
// Confirming is an explicit button, never the bare GET: mail scanners prefetch
// links, and a prefetch must not verify anything. The AuthGate is bypassed on
// this path so a signed-out user can reach it.
export const Route = createFileRoute('/verify-email')({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === 'string' ? s.token : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const t = useT();
  const { token } = Route.useSearch();
  const { client } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'checking' | 'invalid' | 'ok' | 'done'>('checking');
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    let cancelled = false;
    client
      .checkEmailVerification(token)
      .then((r) => {
        if (cancelled) return;
        setUsername(r.username ?? null);
        setStatus(r.valid ? 'ok' : 'invalid');
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [client, token]);

  async function submit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await client.confirmEmailVerification(token);
      setStatus('done');
      setTimeout(() => void navigate({ to: '/login' }), 2500);
    } catch {
      setError(t('auth.verifyFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ ...SCREEN, background: PAGE_RADIAL }}>
      {/* Auto margins (not justify-center) so a taller block scrolls instead of
          clipping its top on a small phone viewport. */}
      <Box w="100%" align="center" m="auto">
        <Box mb={40}>
          <Logo size={24} />
        </Box>

        {status === 'checking' ? <Spinner /> : null}
        {status === 'invalid' ? (
          <Box>
            <Text variant="heading" accessibilityRole="header" textAlign="center" mb={8}>
              {t('auth.verifyInvalidTitle')}
            </Text>
            <Text variant="body" color="textMuted" textAlign="center">
              {t('auth.verifyInvalidDesc')}
            </Text>
          </Box>
        ) : null}
        {status === 'done' ? (
          <Box>
            <Text variant="heading" accessibilityRole="header" textAlign="center" mb={8}>
              {t('auth.verifyDoneTitle')}
            </Text>
            <Text variant="body" color="textMuted" textAlign="center">
              {t('auth.verifyDoneDesc')}
            </Text>
          </Box>
        ) : null}
        {status === 'ok' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            style={FORM}
          >
            <Text variant="heading" accessibilityRole="header">
              {t('auth.verifyTitle')}
            </Text>
            {username ? (
              <Text variant="body" color="textMuted" textAlign="center">
                {username}
              </Text>
            ) : null}

            {error ? (
              <Text variant="meta" color="danger">
                {error}
              </Text>
            ) : null}

            <Button
              block
              label={busy ? t('common.saving') : t('auth.verifySubmit')}
              onPress={() => void submit()}
              loading={busy}
            />
          </form>
        ) : null}
      </Box>
    </main>
  );
}

const SCREEN = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  paddingInline: 24,
  paddingBlock: 48,
} as const;

const FORM = {
  display: 'flex',
  width: '100%',
  maxWidth: 380,
  flexDirection: 'column',
  alignItems: 'center',
  gap: 20,
} as const;
