import { ThemeToggle } from '#site/components/theme-toggle';
import { Box, Row } from '#ui/components/atoms/box';
import { Divider } from '#ui/components/atoms/divider';
import { Logo } from '#ui/components/atoms/logo';
import { Txt } from '#ui/components/atoms/text';

export function SiteHeader({ title }: Readonly<{ title: string }>) {
  return (
    <Box bg="surface1">
      <Box px={28} py={14}>
        <Row gap={14} style={ROW}>
          <Row gap={12} style={{ alignItems: 'center', minWidth: 0 }}>
            <Logo size={26} />
            <Box h={18}>
              <Divider vertical />
            </Box>
            <Txt color="textMuted" variant="label">
              {title}
            </Txt>
          </Row>
          <ThemeToggle />
        </Row>
      </Box>
      <Divider />
    </Box>
  );
}

const ROW = {
  alignItems: 'center',
  justifyContent: 'space-between',
  maxWidth: 1080,
  marginLeft: 'auto',
  marginRight: 'auto',
  width: '100%',
} as const;
