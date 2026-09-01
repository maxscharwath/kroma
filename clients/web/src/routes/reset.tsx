import { useT } from '@kroma/ui';
import { Box, Button, Field, Logo, Text } from '@kroma/ui/kit';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Spinner } from '#web/features/accounts/auth-gate';
import { useAuth } from '#web/shared/lib/auth';
import { PAGE_RADIAL } from '#web/shared/ui';

// Public credential-reset page. An admin (with `users.manage`) mints a reset and
// shares `/reset?token=TOKEN`. The emailed link never carries more: the user also
// enters the one-time code the owner read to them, so intercepting the email
// gives nothing. A hand-copied link may embed the code (`&code=`), which just
// prefills the field. The global AuthGate is bypassed on this path so a
// locked-out user can reach it.
export const Route = createFileRoute('/reset')({
  validateSearch: (s: Record<string, unknown>): { token?: string; code?: string } => ({
    token: typeof s.token === 'string' ? s.token : undefined,
    code: typeof s.code === 'string' ? s.code : undefined,
  }),
  component: ResetPage,
});

function ResetPage() {
  const t = useT();
  const { token, code: codeFromUrl } = Route.useSearch();
  const { client } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'checking' | 'invalid' | 'ok' | 'done'>('checking');
  const [username, setUsername] = useState<string | null>(null);
  const [code, setCode] = useState(codeFromUrl ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    let cancelled = false;
    client
      .checkReset(token)
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

  const valid = code.trim().length === 8 && password.length >= 8;

  async function submit() {
    if (!valid || !token) return;
    setBusy(true);
    setError(null);
    try {
      await client.redeemReset(token, code.trim(), password);
      setStatus('done');
      setTimeout(() => void navigate({ to: '/login' }), 2500);
    } catch {
      setError(t('auth.resetFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ ...SCREEN, background: PAGE_RADIAL }}>
      {/* Auto margins (not justify-center) so a form taller than a small phone
          viewport scrolls instead of clipping its top. */}
      <Box w="100%" align="center" m="auto">
        <Box mb={40}>
          <Logo size={24} />
        </Box>

        {status === 'checking' ? <Spinner /> : null}
        {status === 'invalid' ? (
          <Box>
            <Text variant="heading" accessibilityRole="header" textAlign="center" mb={8}>
              {t('auth.resetInvalidTitle')}
            </Text>
            <Text variant="body" color="textMuted" textAlign="center">
              {t('auth.resetInvalidDesc')}
            </Text>
          </Box>
        ) : null}
        {status === 'done' ? (
          <Box>
            <Text variant="heading" accessibilityRole="header" textAlign="center" mb={8}>
              {t('auth.resetDoneTitle')}
            </Text>
            <Text variant="body" color="textMuted" textAlign="center">
              {t('auth.resetDoneDesc')}
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
              {t('auth.resetTitle')}
            </Text>
            {username ? (
              <Text variant="body" color="textMuted" textAlign="center">
                {username}
              </Text>
            ) : null}

            <Field.Root w="100%" size="md" label={t('auth.resetCode')} hideLabel>
              <Field.Input
                lift
                icon="key"
                placeholder={t('auth.resetCode')}
                value={code}
                onValueChange={setCode}
                autoComplete="one-time-code"
              />
            </Field.Root>
            <Field.Root w="100%" size="md" label={t('auth.newPassword')} hideLabel>
              <Field.Input
                lift
                type="password"
                icon="lock"
                placeholder={t('auth.newPassword')}
                value={password}
                onValueChange={setPassword}
                autoComplete="new-password"
                autoFocus={Boolean(codeFromUrl)}
              />
            </Field.Root>

            {error ? (
              <Text variant="meta" color="danger">
                {error}
              </Text>
            ) : null}

            <Button
              block
              label={busy ? t('common.saving') : t('auth.resetSubmit')}
              onPress={() => void submit()}
              loading={busy}
              disabled={!valid}
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
