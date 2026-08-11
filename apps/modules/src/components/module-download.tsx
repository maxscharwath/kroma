import type { Download } from '#site/lib/artifacts';
import { mb, platformLabel } from '#site/lib/ui';
import { Column } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { IconButton } from '#ui/components/atoms/icon-button';
import { Txt } from '#ui/components/atoms/text';
import { ButtonGroup } from '#ui/components/molecules/button-group';
import { Menu, type MenuProps } from '#ui/components/organisms/menu';

const PICK = 'Choose a platform';

const pickTrigger: NonNullable<MenuProps['trigger']> = ({ ref, expanded, open }) => (
  <IconButton
    ref={ref}
    variant="primary"
    icon="chevron-down"
    label={PICK}
    expanded={expanded}
    onPress={open}
  />
);

export interface ModuleDownloadProps {
  files: Download[];
  picked: Download;
  onPick: (target: string | null) => void;
}

/** The card's primary action: the `.kmod` for the chosen platform, with the
 *  other builds one press away on the split button's menu. */
export function ModuleDownload({ files, picked, onPick }: Readonly<ModuleDownloadProps>) {
  const caption = [platformLabel(picked.target), mb(picked.size)].filter(Boolean).join(' · ');
  return (
    <Column gap={6} align="flex-end" shrink={0}>
      {files.length > 1 ? (
        <ButtonGroup.Root label="Download" size="sm">
          <Button
            variant="primary"
            icon="download"
            label="Download"
            href={picked.url}
            role="link"
          />
          <ButtonGroup.Separator />
          <Menu
            label={PICK}
            align="end"
            items={files.map((file) => ({
              icon: file === picked ? 'check' : 'download',
              label: platformLabel(file.target),
              onSelect: () => onPick(file.target),
            }))}
            trigger={pickTrigger}
          />
        </ButtonGroup.Root>
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon="download"
          label="Download"
          href={picked.url}
          role="link"
        />
      )}
      <Txt color="textDim" variant="meta" lines={1}>
        {caption}
      </Txt>
    </Column>
  );
}
