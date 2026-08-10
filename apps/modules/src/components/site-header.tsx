import { Box, Row } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Divider } from '#ui/components/atoms/divider';
import { Logo } from '#ui/components/atoms/logo';
import { Txt } from '#ui/components/atoms/text';
import { ThemeSwitch } from '#ui/components/molecules/theme-switch';

const EN = { system: 'Auto', light: 'Light', dark: 'Dark' };
const REPO = 'https://github.com/maxscharwath/kroma';

export function SiteHeader({ title }: Readonly<{ title: string }>) {
  return (
    <Box bg="surface1">
      <Box px={16} py={14}>
        <Row gap={14} between w="100%" maxW={1080} mx="auto">
          <Row gap={12} minW={0} shrink={1}>
            <Logo size={26} />
            <Box h={18} shrink={0}>
              <Divider vertical />
            </Box>
            <Txt color="textMuted" variant="label" lines={1}>
              {title}
            </Txt>
          </Row>
          <Row gap={10} shrink={0}>
            <Button
              variant="ghost"
              size="sm"
              icon="brand-github"
              label="GitHub"
              href={REPO}
              role="link"
            />
            <ThemeSwitch label="Theme" labels={EN} />
          </Row>
        </Row>
      </Box>
      <Divider />
    </Box>
  );
}
