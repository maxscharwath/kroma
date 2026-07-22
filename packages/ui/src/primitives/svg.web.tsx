// The SVG element set, web (Tizen / webOS / desktop / browser): plain DOM svg.
//
// react-native-svg does run under react-native-web, but it drags a large runtime
// through the bundler to reproduce something the browser already does natively,
// and every byte counts on a TV's slow connection. Its prop names are the SVG
// attribute names in camelCase, which is exactly what React DOM wants, so these
// wrappers are pass-throughs rather than translations.

import type { SVGProps } from 'react';

type El<T> = (props: SVGProps<T>) => React.ReactElement;

export const Svg: El<SVGSVGElement> = (props) => (
  <svg aria-hidden="true" focusable="false" {...props} />
);
export const Path: El<SVGPathElement> = (props) => <path {...props} />;
export const Circle: El<SVGCircleElement> = (props) => <circle {...props} />;
export const Rect: El<SVGRectElement> = (props) => <rect {...props} />;
export const Line: El<SVGLineElement> = (props) => <line {...props} />;
export const Polyline: El<SVGPolylineElement> = (props) => <polyline {...props} />;
export const Polygon: El<SVGPolygonElement> = (props) => <polygon {...props} />;
export const Ellipse: El<SVGEllipseElement> = (props) => <ellipse {...props} />;
export const G: El<SVGGElement> = (props) => <g {...props} />;
