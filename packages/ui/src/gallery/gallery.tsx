// The design-system gallery: every primitive, in every state the design defines,
// on one screen.
//
// It exists to be LOOKED AT. The unit tests prove a component's behaviour, but
// nothing in a test suite tells you the amber ring sits 4px off the artwork or
// that the poster scrim reaches far enough for the title to read. This is the
// artefact for that, and because it renders from the same kit as the app, it is
// also the fastest way to see a token change land everywhere at once.
//
// It is a normal screen built from the kit, so it renders on every target: open
// it in a browser shell, or mount it in the native app, and you are looking at
// the same components the app ships.

import { useState } from 'react';
import { ScrollView } from 'react-native';
import { ICON_NAMES } from '../lib/glyph';
import { colors, type TypeRole, type as typeRoles } from '../lib/tokens';
import { Avatar } from '../ui/avatar';
import { Badge, type BadgeTone } from '../ui/badge';
import { Box } from '../ui/box';
import { Button, type ButtonVariant } from '../ui/button';
import { Chip } from '../ui/chip';
import { Dialog } from '../ui/dialog';
import { Divider } from '../ui/divider';
import { EmptyState } from '../ui/empty-state';
import { Focusable } from '../ui/focusable';
import { Grid } from '../ui/grid';
import { Icon } from '../ui/icon';
import { IconButton } from '../ui/icon-button';
import { Logo } from '../ui/logo';
import { MediaCard } from '../ui/media-card';
import { PosterCard } from '../ui/poster-card';
import { Progress } from '../ui/progress';
import { ProgressRing } from '../ui/progress-ring';
import { Rail } from '../ui/rail';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { Txt } from '../ui/text';
import { TextField } from '../ui/text-field';
import { Wheel } from '../ui/wheel';

const TINT = ['#3A2E4F', '#1B1524'] as const;
const VARIANTS: ButtonVariant[] = ['primary', 'glass', 'ghost', 'outline', 'danger'];
const TONES: BadgeTone[] = ['4K', 'HDR', 'H.265', 'success', 'info', 'neutral'];
const ROLES: TypeRole[] = ['hero', 'h1', 'h2', 'title', 'body', 'label', 'meta', 'overline'];

/** One labelled band of the gallery. */
function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <Box gap={16} mb={48}>
      <Txt variant="overline" color="accent">
        {title}
      </Txt>
      <Divider spacing={0} />
      <Box gap={20} pt={8}>
        {children}
      </Box>
    </Box>
  );
}

export function Gallery() {
  const [query, setQuery] = useState('Dune');
  const [dialog, setDialog] = useState(false);
  const [chip, setChip] = useState('Ajoutés');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 64, paddingBottom: 160 }}
      showsVerticalScrollIndicator={false}
    >
      <Box row align="center" gap={20} mb={40}>
        <Logo size={40} />
        <Txt variant="h1">Design system</Txt>
      </Box>

      <Section title="Typography">
        {ROLES.map((role) => (
          <Box key={role} row align="baseline" gap={24}>
            <Txt variant="meta" color="textDim" style={{ width: 96 }}>
              {role}
            </Txt>
            <Txt variant={role}>
              {`${typeRoles[role].fontSize}px / ${typeRoles[role].fontWeight}`}
            </Txt>
          </Box>
        ))}
      </Section>

      <Section title="Colour">
        <Box row wrap gap={16}>
          {(Object.keys(colors) as (keyof typeof colors)[]).map((token) => (
            <Box key={token} gap={8} w={150}>
              <Box h={56} radius="md" bg={token} border="border" />
              <Txt variant="meta" color="textDim">
                {token}
              </Txt>
            </Box>
          ))}
        </Box>
      </Section>

      <Section title="Buttons">
        <Box row wrap align="center" gap={16}>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} label={variant} />
          ))}
        </Box>
        <Box row wrap align="center" gap={16}>
          <Button size="sm" label="sm" />
          <Button size="md" label="md" />
          <Button size="lg" label="lg" />
          <Button size="tv" label="tv" icon="player-play-filled" />
          <Button label="disabled" disabled />
          <Button variant="outline" active label="active" icon="check" />
        </Box>
        <Box row wrap align="center" gap={16}>
          <IconButton icon="volume" label="volume" />
          <IconButton icon="settings" label="settings" variant="ghost" />
          <IconButton icon="player-play-filled" label="play" variant="primary" size={48} />
        </Box>
      </Section>

      <Section title="Chips and badges">
        <Box row wrap align="center" gap={12}>
          {['Ajoutés', 'Sortie', 'Titre', 'Note'].map((label) => (
            <Chip
              key={label}
              label={label}
              active={chip === label}
              onPress={() => setChip(label)}
            />
          ))}
        </Box>
        <Box row wrap align="center" gap={12}>
          <Chip variant="subtle" label="subtle" icon="search" />
          <Chip variant="surface" label="surface" />
          <Chip size="tv" label="10-foot" />
        </Box>
        <Box row wrap align="center" gap={12}>
          {TONES.map((tone) => (
            <Badge key={tone} tone={tone} />
          ))}
          <Badge tone="4K" size="tv">
            4K
          </Badge>
        </Box>
      </Section>

      <Section title="Focus">
        <Txt variant="meta" color="textDim">
          The signature 10-foot affordance: a solid amber ring plus a dark lift. The first control
          below holds focus on mount.
        </Txt>
        <Box row wrap align="center" gap={24}>
          <Focusable autoFocus style={FOCUS_DEMO} label="ring only">
            <Txt>ring only</Txt>
          </Focusable>
          <Focusable focusScale={1.06} style={FOCUS_DEMO} label="ring and scale">
            <Txt>ring + scale</Txt>
          </Focusable>
          <Focusable ring={false} style={FOCUS_DEMO} label="no ring">
            <Txt>no ring</Txt>
          </Focusable>
        </Box>
      </Section>

      <Section title="Fields">
        <Box w={520}>
          <TextField
            value={query}
            onChange={setQuery}
            icon="search"
            label="Rechercher"
            h={68}
            bg="rgba(255, 255, 255, 0.05)"
            textStyle={{ fontSize: 24, fontWeight: '600' }}
          />
        </Box>
        <Box w={520}>
          <TextField
            value=""
            onChange={() => {}}
            placeholder="kroma.local:4040"
            icon="world-search"
            physicalKeyboard
            py={16}
            radius="md"
            bg="#0F0F13"
            textStyle={{ fontSize: 20, fontWeight: '600' }}
          />
        </Box>
      </Section>

      <Section title="Progress and loading">
        <Box row align="center" gap={32}>
          <Box w={320}>
            <Progress value={0.42} />
          </Box>
          <Box w={320}>
            <Progress value={0.72} rounded size={10} />
          </Box>
          <ProgressRing value={0.62} size={40} stroke={4} />
          <Spinner />
          <Spinner size={40} color={colors.info} />
        </Box>
        <Box row gap={16}>
          <Skeleton w={220} h={22} />
          <Skeleton w={140} h={22} />
          <Skeleton w={90} h={22} radius="pill" />
        </Box>
      </Section>

      <Section title="Identity">
        <Box row align="center" gap={24}>
          <Avatar name="Marie Curie" seed="a" size={96} />
          <Avatar name="Jean Claude" seed="b" size={96} />
          <Avatar name="Ada Lovelace" seed="c" size={96} locked />
          <Avatar name="Alan Turing" seed="d" size={96} radius={999} />
          <Wheel size={72} />
          <Logo size={40} />
        </Box>
      </Section>

      <Section title="Media">
        <Rail title="Rail" inset={0}>
          {[0, 1, 2, 3].map((i) => (
            <MediaCard
              key={i}
              title={`Titre ${i + 1}`}
              overline="Science-fiction"
              art={null}
              tint={TINT}
              progress={i === 0 ? 0.35 : null}
              watched={i === 1}
            />
          ))}
        </Rail>
        <Grid width={1200} columns={5} gap={24}>
          {[0, 1, 2, 3, 4].map((i) => (
            <PosterCard
              key={i}
              title={`Affiche ${i + 1}`}
              art={null}
              tint={TINT}
              watched={i === 2}
              progress={i === 4 ? 0.6 : null}
            />
          ))}
        </Grid>
      </Section>

      <Section title="States">
        <EmptyState
          icon="mood-empty"
          title="Aucun résultat"
          hint="Essayez un autre terme, ou vérifiez que le serveur est joignable."
        />
        <Box row gap={16}>
          <Button label="Ouvrir une boîte de dialogue" onPress={() => setDialog(true)} />
        </Box>
      </Section>

      <Section title="Icons">
        <Box row wrap gap={20}>
          {ICON_NAMES.map((name) => (
            <Box key={name} w={104} align="center" gap={8}>
              <Icon name={name} size={26} />
              <Txt variant="meta" color="textDim" lines={1} style={{ textAlign: 'center' }}>
                {name}
              </Txt>
            </Box>
          ))}
        </Box>
      </Section>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Supprimer ce profil ?"
        description="Cette action est irréversible."
      >
        <Box row justify="flex-end" gap={12}>
          <Button variant="ghost" label="Annuler" onPress={() => setDialog(false)} />
          <Button variant="danger" label="Supprimer" onPress={() => setDialog(false)} autoFocus />
        </Box>
      </Dialog>
    </ScrollView>
  );
}

const FOCUS_DEMO = {
  paddingVertical: 16,
  paddingHorizontal: 28,
  borderRadius: 13,
  backgroundColor: colors.surface2,
};
