// Geometry for the Gantt chart, as pure functions: calendar arithmetic, axis ticks, and the
// route a dependency line takes between two bars.
//
// The old arrows went right past the successor's left edge, down, and then back left across
// the bar they were meant to point at, so every dependency looked like a scribble on top of
// the bar. These routes stay in the gaps: out of the predecessor's right edge, one clean
// vertical, and into the successor's left edge, or - when the successor starts at or before
// the predecessor's end - around the successor and in from the left.

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-day arithmetic that survives daylight-saving changes (adding 24h would not). */
export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const startOfDay = (date) => addDays(date, 0);

const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const DAY_STEPS = [1, 2, 3, 7, 14];
const MONTH_STEPS = [1, 2, 3, 6, 12];

/**
 * Axis ticks that land on real day boundaries ("every Monday", "the 1st of each month")
 * instead of seven evenly spaced instants rounded to a day, which put the label up to a
 * day away from the position it was drawn at.
 *
 * @param {Date} min first instant on the axis
 * @param {Date} max last instant on the axis
 * @param {number} [target] roughly how many ticks to aim for
 * @returns {Date[]} day starts, ascending, all within [min, max]
 */
export const axisTicks = (min, max, target = 6) => {
  const spanDays = (max.getTime() - min.getTime()) / DAY_MS;
  if (!(spanDays > 0)) return [];
  const limit = target + 1;

  const step = DAY_STEPS.find((d) => spanDays / d <= limit);
  const ticks = [];
  if (step) {
    let t = startOfDay(min);
    if (t < min) t = addDays(t, 1);
    if (step >= 7) {
      // weekly steps start on a Monday so the labels read as week starts
      t = addDays(t, (8 - t.getDay()) % 7);
    }
    for (; t <= max; t = addDays(t, step)) ticks.push(t);
    return ticks;
  }

  const months = MONTH_STEPS.find((m) => spanDays / (m * 30.4) <= limit) || 12;
  let t = new Date(min.getFullYear(), min.getMonth(), 1);
  if (t < min) t = addMonths(t, 1);
  for (; t <= max; t = addMonths(t, months)) ticks.push(t);
  return ticks;
};

const BEND = 10;        // how far past the predecessor's end the vertical segment sits
const ARROW = 8;        // arrowhead length; see the marker in the chart
const MIN_RUN = 4;      // straight line wanted between the last corner and the arrowhead
const APPROACH = ARROW + 6; // final horizontal run of a detour, arrowhead included
const CHANNEL = 17;     // distance from the successor's row centre to the horizontal detour lane
                        // (a 48px row: 7px clear of the bar below the lane, 7px clear of the row border)

/**
 * The corner points of a finish-to-start dependency line, orthogonal, from the right edge
 * of the predecessor's bar to the left edge of the successor's bar.
 *
 * - `direct`: the successor starts far enough to the right. Out, one vertical, in.
 * - `detour`: it starts at or before the predecessor's end (or too close for an arrowhead).
 *   Out, down (or up) to a lane just clear of the successor's bar, back along the lane, then
 *   down into the successor's row and in from the left.
 *
 * @param {{exitX:number, exitY:number, entryX:number, entryY:number}} anchor
 * @returns {{ points: {x:number,y:number}[], route: 'direct'|'detour'|'straight' }}
 */
export const routeDependency = ({ exitX, exitY, entryX, entryY }) => {
  const gap = entryX - exitX;

  if (exitY === entryY) {
    return { route: 'straight', points: [{ x: exitX, y: exitY }, { x: entryX, y: entryY }] };
  }

  // room for a bend, some line, and the arrowhead
  if (gap >= ARROW + MIN_RUN + 4) {
    const bend = exitX + Math.min(BEND, gap - ARROW - MIN_RUN);
    return {
      route: 'direct',
      points: [
        { x: exitX, y: exitY },
        { x: bend, y: exitY },
        { x: bend, y: entryY },
        { x: entryX, y: entryY },
      ],
    };
  }

  const dir = entryY > exitY ? 1 : -1;
  const laneY = entryY - dir * CHANNEL;
  const outX = exitX + BEND;
  const inX = Math.max(entryX - APPROACH, 2);
  return {
    route: 'detour',
    points: [
      { x: exitX, y: exitY },
      { x: outX, y: exitY },
      { x: outX, y: laneY },
      { x: inX, y: laneY },
      { x: inX, y: entryY },
      { x: entryX, y: entryY },
    ],
  };
};

/**
 * Start-to-start and finish-to-finish lines: a bracket on one side of both bars.
 * SS leaves the predecessor's left edge, runs left of both bars and enters the successor's
 * left edge; FF leaves the right edge, runs right of both and enters the successor's right
 * edge (the arrow then points left, at the end the link is about).
 *
 * @param {'SS'|'FF'} type
 * @param {{leftPx:number, rightPx:number, y:number}} pred
 * @param {{leftPx:number, rightPx:number, y:number}} succ
 */
const routeBracket = (type, pred, succ) => {
  if (type === 'SS') {
    const x = Math.max(Math.min(pred.leftPx, succ.leftPx) - BEND, 2);
    return {
      route: 'bracket',
      points: [
        { x: pred.leftPx, y: pred.y },
        { x, y: pred.y },
        { x, y: succ.y },
        { x: succ.leftPx - 1, y: succ.y },
      ],
    };
  }
  const x = Math.max(pred.rightPx, succ.rightPx) + BEND;
  return {
    route: 'bracket',
    points: [
      { x: pred.rightPx, y: pred.y },
      { x, y: pred.y },
      { x, y: succ.y },
      { x: succ.rightPx + 1, y: succ.y },
    ],
  };
};

/**
 * The line for a dependency of any type between two bars.
 * @param {'FS'|'SS'|'FF'} type
 * @param {{leftPx:number, rightPx:number, y:number}} pred
 * @param {{leftPx:number, rightPx:number, y:number}} succ
 */
export const routeLink = (type, pred, succ) => {
  if (type === 'SS' || type === 'FF') return routeBracket(type, pred, succ);
  // one pixel short, so the arrowhead touches the bar instead of overlapping its edge
  return routeDependency({ exitX: pred.rightPx, exitY: pred.y, entryX: succ.leftPx - 1, entryY: succ.y });
};

const round = (n) => Math.round(n * 100) / 100;

/**
 * An SVG path through `points` with every interior corner rounded. A corner's radius is
 * limited to half of the shorter segment next to it, so short segments never overshoot.
 */
export const roundedPath = (points, radius = 5) => {
  if (!points || points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M ${round(first.x)} ${round(first.y)}`;
  for (let i = 0; i < rest.length; i += 1) {
    const prev = i === 0 ? first : rest[i - 1];
    const here = rest[i];
    const next = rest[i + 1];
    if (!next) {
      d += ` L ${round(here.x)} ${round(here.y)}`;
      break;
    }
    const inLen = Math.hypot(here.x - prev.x, here.y - prev.y);
    const outLen = Math.hypot(next.x - here.x, next.y - here.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.5 || inLen === 0 || outLen === 0) {
      d += ` L ${round(here.x)} ${round(here.y)}`;
      continue;
    }
    const ax = here.x - ((here.x - prev.x) / inLen) * r;
    const ay = here.y - ((here.y - prev.y) / inLen) * r;
    const bx = here.x + ((next.x - here.x) / outLen) * r;
    const by = here.y + ((next.y - here.y) / outLen) * r;
    d += ` L ${round(ax)} ${round(ay)} Q ${round(here.x)} ${round(here.y)} ${round(bx)} ${round(by)}`;
  }
  return d;
};

/**
 * How a dependency should look, in priority order:
 *  - `conflict`: the prerequisite is still open but the dependent task is scheduled earlier
 *    than the link allows (for finish-to-start: to start before it ends), so the plan
 *    contradicts itself
 *  - `critical`: both ends are on the critical path
 *  - `done`: the prerequisite is finished, so nothing is holding the successor up any more
 *  - `open`: an ordinary prerequisite that still has to finish
 *
 * @param {{ start: Date, end: Date, resolved: boolean, critical: boolean }} pred
 * @param {{ start: Date, end?: Date, critical: boolean }} succ
 * @param {(pred, succ) => boolean} [breaksLink] the link's rule (see lib/dependencyLinks.violates);
 *        by default finish-to-start with no lag
 */
export const dependencyKind = (pred, succ, breaksLink = (p, s) => s.start.getTime() <= p.end.getTime()) => {
  if (!pred.resolved && breaksLink(pred, { ...succ, end: succ.end || succ.start })) return 'conflict';
  if (pred.critical && succ.critical) return 'critical';
  if (pred.resolved) return 'done';
  return 'open';
};

/**
 * A bar's dates after dragging it `days` days. `mode` is what was dragged:
 *  - 'move': the whole bar (both dates move)
 *  - 'start': the left edge (start moves, never past the end)
 *  - 'end': the right edge (end moves, never before the start)
 * A milestone only ever moves as a whole.
 *
 * @param {{ start: Date, end: Date }} range local day starts
 * @param {'move'|'start'|'end'} mode
 * @param {number} days
 * @returns {{ start: Date, end: Date }}
 */
export const shiftRange = ({ start, end }, mode, days) => {
  const d = Math.trunc(days) || 0;
  if (mode === 'start') {
    const s = addDays(start, d);
    return { start: s > end ? end : s, end };
  }
  if (mode === 'end') {
    const e = addDays(end, d);
    return { start, end: e < start ? start : e };
  }
  return { start: addDays(start, d), end: addDays(end, d) };
};
