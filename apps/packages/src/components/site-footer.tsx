import { site } from '@kroma/site-meta';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Divider } from '#ui/components/atoms/divider';
import { Logo } from '#ui/components/atoms/logo';
import { Txt } from '#ui/components/atoms/text';

const BLURB =
  'The Synology package source for KROMA: every release, stable and nightly, served straight to DSM Package Center.';

const COLUMNS = [
  {
    title: 'KROMA',
    links: [
      { label: 'Website', href: site.url },
      { label: 'TV demo', href: site.tvUrl },
      { label: 'UI kit', href: site.uiUrl },
      { label: 'Modules', href: site.modulesUrl },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Source code', href: site.repo },
      { label: 'Releases', href: site.links.releases },
      { label: 'Install guide', href: site.links.installGuide },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: site.links.privacy },
      { label: 'Support', href: site.links.support },
      { label: `${site.license} license`, href: site.links.license },
    ],
  },
];

function FooterColumn({
  title,
  links,
}: Readonly<{ title: string; links: readonly { label: string; href: string }[] }>) {
  return (
    <Column gap={8} grow={1} shrink={1} basis={160} minW={140}>
      <Box pl={16}>
        <Txt variant="overline" color="textDim">
          {title}
        </Txt>
      </Box>
      <Column gap={2} align="flex-start">
        {links.map((link) => (
          <Button
            key={link.label}
            variant="ghost"
            size="sm"
            role="link"
            href={link.href}
            label={link.label}
          />
        ))}
      </Column>
    </Column>
  );
}

/** The site-wide footer. `source` is the package-source URL this deployment
 *  serves, which is the one address a DSM owner came here for. */
export function SiteFooter({ source }: Readonly<{ source: string }>) {
  return (
    <Box bg="surface1" role="contentinfo">
      <Divider />
      <Box px={28} py={48}>
        <Column gap={36} w="100%" maxW={1080} mx="auto">
          <Row gap={36} wrap align="flex-start">
            <Column gap={16} grow={1} shrink={1} basis={300} minW={220} maxW={380}>
              <Logo size={26} />
              <Txt color="textMuted" variant="meta">
                {BLURB}
              </Txt>
              <Column gap={4}>
                <Txt variant="overline" color="textDim">
                  Package source
                </Txt>
                <Txt variant="meta" font="mono" color="textMuted" lines={1}>
                  {source}
                </Txt>
              </Column>
              <Row gap={8} wrap>
                <Button
                  variant="glass"
                  size="sm"
                  icon="brand-github"
                  role="link"
                  href={site.repo}
                  label="Star on GitHub"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon="mail"
                  role="link"
                  href={`mailto:${site.email.support}`}
                  label={site.email.support}
                />
              </Row>
            </Column>
            {COLUMNS.map((column) => (
              <FooterColumn key={column.title} title={column.title} links={column.links} />
            ))}
          </Row>

          <Divider />

          <Row gap={12} wrap between>
            <Txt variant="meta" color="textDim">
              {`© 2026 KROMA. Free software under the ${site.license} license.`}
            </Txt>
            <Txt variant="meta" color="textDim">
              Built to be owned, not rented.
            </Txt>
          </Row>
        </Column>
      </Box>
    </Box>
  );
}
