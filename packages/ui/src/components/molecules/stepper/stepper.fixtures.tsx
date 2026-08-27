import { useState } from 'react';
import { Box, Row } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Text } from '#ui/components/atoms/text';
import { TextField } from '#ui/components/atoms/text-field';
import type { ControlSize } from '#ui/lib/field-shell';
import { Stepper, type StepperOrientation, useStepper } from './stepper';

export interface DemoProps {
  orientation?: StepperOrientation;
  size?: ControlSize;
}

function Panels() {
  return (
    <>
      <Stepper.Panel value="account">
        <Text color="textDim">Une adresse et un mot de passe.</Text>
      </Stepper.Panel>
      <Stepper.Panel value="library">
        <Text color="textDim">Les dossiers à parcourir.</Text>
      </Stepper.Panel>
      <Stepper.Panel value="done">
        <Text color="textDim">Tout est prêt.</Text>
      </Stepper.Panel>
    </>
  );
}

function Steps() {
  return (
    <Stepper.List>
      <Stepper.Item value="account" icon="user">
        <Stepper.Label>Compte</Stepper.Label>
        <Stepper.Hint>Adresse et mot de passe</Stepper.Hint>
      </Stepper.Item>
      <Stepper.Item value="library" icon="folder">
        <Stepper.Label>Bibliothèque</Stepper.Label>
        <Stepper.Hint>Où sont les films</Stepper.Hint>
      </Stepper.Item>
      <Stepper.Item value="done" icon="rocket">
        <Stepper.Label>Fin</Stepper.Label>
      </Stepper.Item>
    </Stepper.List>
  );
}

export function Walkthrough({ orientation, size }: Readonly<DemoProps>) {
  return (
    <Box w={orientation === 'vertical' ? 360 : 640}>
      <Stepper.Root label="Configuration" orientation={orientation} size={size}>
        <Steps />
        <Panels />
        <Row gap={12}>
          <Stepper.Previous />
          <Stepper.Next />
        </Row>
      </Stepper.Root>
    </Box>
  );
}

export function Validated({ size }: Readonly<DemoProps>) {
  const [address, setAddress] = useState('');
  const named = address.trim().length > 0;
  return (
    <Box w={640}>
      <Stepper.Root label="Configuration" size={size} complete={named ? DONE : NONE}>
        <Steps />
        <Stepper.Panel value="account">
          <TextField placeholder="vous@exemple.tv" value={address} onValueChange={setAddress} />
        </Stepper.Panel>
        <Stepper.Panel value="library">
          <Text color="textDim">Les dossiers à parcourir.</Text>
        </Stepper.Panel>
        <Stepper.Panel value="done">
          <Text color="textDim">Tout est prêt.</Text>
        </Stepper.Panel>
        <Row gap={12}>
          <Stepper.Previous />
          <Stepper.Next disabled={!named} />
        </Row>
      </Stepper.Root>
    </Box>
  );
}

const DONE = ['account'];
const NONE: string[] = [];

function OwnFooter() {
  const flow = useStepper();
  return (
    <Row gap={12}>
      <Text variant="meta" color="textDim">
        {`${flow.index + 1} / ${flow.count}`}
      </Text>
      <Box flex />
      <Button variant="ghost" label="Recommencer" onPress={flow.reset} />
      <Button
        label={flow.last ? 'Terminer' : 'Continuer'}
        disabled={!flow.canGoNext}
        onPress={flow.next}
      />
    </Row>
  );
}

export function Footer({ size }: Readonly<DemoProps>) {
  return (
    <Box w={640}>
      <Stepper.Root label="Configuration" size={size}>
        <Steps />
        <Panels />
        <OwnFooter />
      </Stepper.Root>
    </Box>
  );
}

export function Kept({ size }: Readonly<DemoProps>) {
  return (
    <Box w={640}>
      <Stepper.Root label="Configuration" size={size}>
        <Steps />
        <Stepper.Panel value="account" keepMounted>
          <TextField placeholder="Tapez ici, puis revenez" />
        </Stepper.Panel>
        <Stepper.Panel value="library">
          <Text color="textDim">Repartez en arrière : le texte est encore là.</Text>
        </Stepper.Panel>
        <Stepper.Panel value="done">
          <Text color="textDim">Tout est prêt.</Text>
        </Stepper.Panel>
        <Row gap={12}>
          <Stepper.Previous />
          <Stepper.Next />
        </Row>
      </Stepper.Root>
    </Box>
  );
}
