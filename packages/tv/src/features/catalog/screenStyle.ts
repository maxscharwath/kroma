// Text metrics shared by the browse screens (person, genre picker, genre grid,
// library grid).
//
// These are the 10-foot sizes the design specifies for a screen's eyebrow, its
// hero title and its empty state. They lived as a verbatim copy in each screen,
// which meant retuning the title for a different panel size was a hunt for three
// identical literals. One home instead, next to the screens that use them.

import type { TextStyle } from 'react-native';

/** Small uppercase eyebrow above a screen's title ("ACTEUR", "GENRE"). */
export const SECTION: TextStyle = {
  fontSize: 13,
  fontWeight: '700',
  letterSpacing: 2.86,
  textTransform: 'uppercase',
};

/** A screen's hero title. `clamp(34px, 5.5vh, 60px)` resolves to 59px on the
 * fixed 1080-tall stage, so it is spelled as the resolved value. */
export const TITLE: TextStyle = {
  fontSize: 59,
  lineHeight: 58,
  fontWeight: '700',
  letterSpacing: -1.18,
};

/** Centred "nothing here" line, held narrow enough to stay readable at 3 metres. */
export const EMPTY: TextStyle = {
  fontSize: 18,
  fontWeight: '500',
  textAlign: 'center',
  maxWidth: 640,
};
