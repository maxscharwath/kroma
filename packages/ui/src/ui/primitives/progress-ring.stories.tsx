import { story } from '../../workbench/story';
import { ProgressRing } from './progress-ring';

export default story({
  name: 'ProgressRing',
  group: 'État',
  docs: "L'anneau de progression, en SVG. Il remplace un conic-gradient CSS, qui n'existe ni sur Apple TV ni sur les vieux navigateurs de téléviseur.",
  matrix: false,
  args: { value: 0.62, size: 64, stroke: 6 },
  controls: {
    value: { min: 0, max: 1, step: 0.05 },
    size: { min: 24, max: 160, step: 8 },
    stroke: { min: 2, max: 16, step: 1 },
  },
  render: (props) => <ProgressRing {...props} />,
});
