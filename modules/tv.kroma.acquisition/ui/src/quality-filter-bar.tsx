import { useT } from '@kroma/module-sdk';
import { Box, Chip, Row, Text } from '@kroma/ui/kit';
import { useCallback } from 'react';
import { EMPTY_QUALITY_FILTER, type QualityFilter } from './release-sort';

const RESOLUTIONS = ['R720', 'R1080', 'R2160'] as const;
const CODECS = ['Hevc', 'H264', 'Av1', 'Xvid'] as const;
const SOURCES = ['Remux', 'BluRay', 'WebDl', 'WebRip', 'Hdtv', 'Cam'] as const;

const RES_LABEL: Record<string, string> = {
  R720: 'requests.filter.res.720',
  R1080: 'requests.filter.res.1080',
  R2160: 'requests.filter.res.2160',
};

const CODEC_LABEL: Record<string, string> = {
  Hevc: 'requests.filter.codec.hevc',
  H264: 'requests.filter.codec.h264',
  Av1: 'requests.filter.codec.av1',
  Xvid: 'requests.filter.codec.xvid',
};

const SOURCE_LABEL: Record<string, string> = {
  Remux: 'requests.filter.src.remux',
  BluRay: 'requests.filter.src.bluRay',
  WebDl: 'requests.filter.src.webDl',
  WebRip: 'requests.filter.src.webRip',
  Hdtv: 'requests.filter.src.hdtv',
  Cam: 'requests.filter.src.cam',
};

export function QualityFilterBar({
  filter,
  onChange,
}: Readonly<{
  filter: QualityFilter;
  onChange: (f: QualityFilter) => void;
}>) {
  const t = useT();

  const toggleArray = useCallback(
    (key: 'resolutions' | 'codecs' | 'sources', value: string) => {
      const current = filter[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...filter, [key]: next });
    },
    [filter, onChange],
  );

  const hasActive =
    filter.resolutions.length > 0 ||
    filter.codecs.length > 0 ||
    filter.sources.length > 0 ||
    filter.hdrOnly ||
    filter.minSeeders != null ||
    filter.maxSizeGb != null;

  return (
    <Box gap={8}>
      <Row wrap gap={6}>
        {RESOLUTIONS.map((r) => (
          <Chip
            key={r}
            label={t(RES_LABEL[r] as Parameters<typeof t>[0])}
            active={filter.resolutions.includes(r)}
            onPress={() => toggleArray('resolutions', r)}
          />
        ))}
        {CODECS.map((c) => (
          <Chip
            key={c}
            label={t(CODEC_LABEL[c] as Parameters<typeof t>[0])}
            active={filter.codecs.includes(c)}
            onPress={() => toggleArray('codecs', c)}
          />
        ))}
        {SOURCES.map((s) => (
          <Chip
            key={s}
            label={t(SOURCE_LABEL[s] as Parameters<typeof t>[0])}
            active={filter.sources.includes(s)}
            onPress={() => toggleArray('sources', s)}
          />
        ))}
        <Chip
          label={t('requests.filter.hdrOnly')}
          active={filter.hdrOnly}
          onPress={() => onChange({ ...filter, hdrOnly: !filter.hdrOnly })}
        />
      </Row>
      <Row wrap gap={10} align="center">
        <Row gap={4} align="center">
          <Text variant="meta" color="textDim">
            {t('requests.filter.minSeeders')}
          </Text>
          <input
            type="number"
            min={0}
            value={filter.minSeeders ?? ''}
            onChange={(e) =>
              onChange({ ...filter, minSeeders: e.target.value ? Number(e.target.value) : null })
            }
            style={{ width: 70, padding: '4px 8px', fontSize: 13 }}
          />
        </Row>
        <Row gap={4} align="center">
          <Text variant="meta" color="textDim">
            {t('requests.filter.maxSizeGb')}
          </Text>
          <input
            type="number"
            min={0}
            step={0.5}
            value={filter.maxSizeGb ?? ''}
            onChange={(e) =>
              onChange({ ...filter, maxSizeGb: e.target.value ? Number(e.target.value) : null })
            }
            style={{ width: 70, padding: '4px 8px', fontSize: 13 }}
          />
        </Row>
        {hasActive ? (
          <Chip
            label={t('requests.filter.reset')}
            active={false}
            onPress={() => onChange({ ...EMPTY_QUALITY_FILTER })}
          />
        ) : null}
      </Row>
    </Box>
  );
}
