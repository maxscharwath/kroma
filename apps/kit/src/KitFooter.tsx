import { Column, ThemeSwitch } from '@kroma/ui/kit';
import { BuildStamp } from './BuildStamp';

export function KitFooter() {
  return (
    <Column gap={10}>
      <ThemeSwitch />
      <BuildStamp />
    </Column>
  );
}
