// The workbench: the kit's own component atelier.
//
// Mount `<Workbench />` from any shell. It is a normal screen built from the
// kit, so it runs in a browser, on a television and on a phone, and there is no
// separate dev server, no manager iframe and no addon layer to keep alive.

export type { MatrixProps, ViewportFrameProps, ViewportName } from './canvas';
export { Matrix, SURFACES, VIEWPORTS, ViewportFrame } from './canvas';
export type { ControlsProps } from './controls';
export { ControlRow, Controls, MAX_CHIPS } from './controls';
export { STORIES } from './registry';
export type { SidebarProps } from './sidebar';
export { matches, Sidebar } from './sidebar';
export type {
  Control,
  ControlSpec,
  MatrixRow,
  ResolvedControl,
  Scene,
  Story,
  StoryDef,
} from './story';
export { GROUP_ORDER, isBooleanGroup, orderStories, slug, story } from './story';
export { Workbench } from './workbench';
