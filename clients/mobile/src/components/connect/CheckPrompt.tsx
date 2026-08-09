// The confirmation a television gets when the server could not place the origin
// its beacon was raised from: read the five characters off its screen and type
// them here.
//
// Shared by both places a phone can sign a television in - the connect screen's
// list and the cast picker - because the ask is the same one and a person who
// has met it once should not meet a second spelling of it.
//
// It asks for what only a screen in the room can show. A page wearing the same
// unplaceable origin can mint a beacon, but it has nowhere to print the code.

import type { DiscoveredTv, GrantRefusal, GrantResult } from '@kroma/core';
import { HANDOFF_CHECK_LENGTH } from '@kroma/core';
import { Box, Button, OtpField, REGEXP_ONLY_DIGITS_AND_CHARS, styles, Txt } from '@kroma/ui/kit';
import { useState } from 'react';
import { useT } from '#mobile/lib/i18n';
import { spacing, type } from '#mobile/lib/theme';

export interface CheckPromptProps {
  device: DiscoveredTv;
  /** Grants with the code that was typed. Answers how it went, so the prompt
   * knows whether another code is worth asking for. */
  onGrant: (device: DiscoveredTv, check: string) => Promise<GrantResult>;
  onCancel: () => void;
}

export function CheckPrompt({ device, onGrant, onCancel }: Readonly<CheckPromptProps>) {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<GrantRefusal | null>(null);
  const asked = t('handoff.checkPrompt', { name: device.name });

  const submit = async (value: string) => {
    setBusy(true);
    setRefused(null);
    const result = await onGrant(device, value);
    setBusy(false);
    if (result === 'granted' || result === 'dropped') return;
    setRefused(result);
    setCode('');
  };

  return (
    <Box style={s.prompt}>
      <Txt style={s.title}>{asked}</Txt>
      <OtpField
        maxLength={HANDOFF_CHECK_LENGTH}
        value={code}
        // A check string is letters as well as digits, so the entry may not be
        // the number pad, and what a phone capitalizes for itself is the
        // keyboard's habit rather than a guarantee.
        onChange={(next) => setCode(next.toUpperCase())}
        onComplete={(value) => void submit(value.toUpperCase())}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        physicalKeyboard
        autoFocus
        disabled={busy}
        invalid={refused !== null}
        label={asked}
      />
      <Txt style={[s.hint, refused ? s.error : null]}>
        {refused ? t(`handoff.${refused}`) : t('handoff.checkHint')}
      </Txt>
      <Button variant="ghost" size="sm" label={t('common.cancel')} onPress={onCancel} />
    </Box>
  );
}

const s = styles({
  prompt: { align: 'center', gap: spacing.md, py: spacing.lg },
  title: { ...type.section, color: 'text', textAlign: 'center' },
  hint: { ...type.caption, color: 'textMuted', textAlign: 'center' },
  error: { color: 'danger', fontWeight: '600' },
});
