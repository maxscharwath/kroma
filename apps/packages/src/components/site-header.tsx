import { Box, Row } from '#ui/components/atoms/box';
import { Divider } from '#ui/components/atoms/divider';
import { Logo } from '#ui/components/atoms/logo';
import { Txt } from '#ui/components/atoms/text';
import { ThemeSwitch } from '#ui/components/molecules/theme-switch';

const EN = { system: 'Auto', light: 'Light', dark: 'Dark' };

export function SiteHeader({ title }: Readonly<{ title: string }>) {
  return (
    <Box bg="surface1">
      <Box px={28} py={14}>
        <Row gap={14} between w="100%" maxW={1080} mx="auto">
          <Row gap={12} minW={0}>
            <Logo size={26} />
            <Box h={18}>
              <Divider vertical />
            </Box>
            <Txt color="textMuted" variant="label">
              {title}
            </Txt>
          </Row>
          <ThemeSwitch label="Theme" labels={EN} />
        </Row>
      </Box>
      <Divider />
    </Box>
  );
}
