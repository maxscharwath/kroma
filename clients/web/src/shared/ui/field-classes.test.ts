// The class strings are written literally so Tailwind's scanner can see them,
// which means nothing stops them drifting from the kit's control shell except
// this test. A kit control and a hand-rolled DOM one sit on the same console
// row; the day they stop matching, this fails instead of the design.

import { CONTROL } from '@kroma/ui/kit';
import { describe, expect, it } from 'vitest';
import { FIELD, FIELD_BOX, FIELD_GROUP, FIELD_TYPE } from './field-classes';

const { radius, px, py, fontSize, gap } = CONTROL.sm;

describe('the web field classes', () => {
  it('wears the kit control shell corner, padding and type', () => {
    expect(FIELD_BOX).toContain(`rounded-[${radius}px]`);
    expect(FIELD_BOX).toContain(`px-[${px}px]`);
    expect(FIELD_BOX).toContain(`py-[${py}px]`);
    expect(FIELD_TYPE).toContain(`text-[${fontSize}px]`);
  });

  it('gives a grouped control the same corner, padding and gap', () => {
    expect(FIELD_GROUP).toContain(`rounded-[${radius}px]`);
    expect(FIELD_GROUP).toContain(`px-[${px}px]`);
    expect(FIELD_GROUP).toContain(`gap-[${gap}px]`);
  });

  it('composes the box and the type into one field recipe', () => {
    expect(FIELD).toBe(`${FIELD_BOX} ${FIELD_TYPE}`);
  });
});
