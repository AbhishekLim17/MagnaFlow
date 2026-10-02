// StatCard - the single stat/metric tile used across dashboards.
//
// Colors are looked up from a STATIC map on purpose: Tailwind's JIT compiler
// only sees class names that appear literally in the source, so interpolated
// classes like `bg-${color}` silently render with no background. StaffDashboard
// previously had exactly that bug.

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';

// Semantic tones. The old palette names (green/blue/red/...) are kept as
// aliases so the ~40 existing call sites keep working while every tile now
// draws from the design tokens instead of raw Tailwind colours.
const TONES = {
  primary: 'text-primary bg-primary-soft',
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-destructive bg-destructive-soft',
  neutral: 'text-muted-foreground bg-muted',
};

const COLOR_CLASSES = {
  ...TONES,
  green: TONES.success,
  blue: TONES.primary,
  indigo: TONES.primary,
  purple: TONES.primary,
  teal: TONES.success,
  red: TONES.danger,
  yellow: TONES.warning,
  slate: TONES.neutral,
};

/**
 * @param {string} title
 * @param {string|number} value
 * @param {ReactNode|Function} icon  a rendered node (<Icon />) or a component ref (Icon)
 * @param {string} color             key of COLOR_CLASSES
 * @param {string} [trend]           small note beside the value
 * @param {string} [description]     small note under the title
 * @param {number} [index]           stagger index for entry animation
 * @param {boolean} [loading]        show a placeholder instead of the value. A tile that
 *                                   reads 0 while its data is still on the way looks like
 *                                   an empty workspace.
 */
const StatCard = ({ title, value, icon, color = 'primary', trend, description, index = 0, loading = false }) => {
  const classes = COLOR_CLASSES[color] || COLOR_CLASSES.primary;

  // Accept both an already-rendered node (<Icon />) and a bare component
  // reference (Icon). Note lucide-react icons are forwardRef *objects*, not
  // functions, so a `typeof === 'function'` test would wrongly fall through and
  // try to render a component object as a child (which crashes the tree).
  let iconNode = null;
  if (React.isValidElement(icon)) {
    iconNode = icon;
  } else if (icon) {
    iconNode = React.createElement(icon, { className: 'w-4 h-4' });
  }

  // A rising number is good news in most of these tiles, so a leading "+" is
  // tinted success and a "-" destructive. Anything else stays neutral rather
  // than guessing.
  const trendTone = /^\+/.test(String(trend ?? ''))
    ? 'text-success'
    : /^-/.test(String(trend ?? ''))
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Card className="h-full p-5">
        <div className="mb-4 flex items-center gap-2">
          {iconNode && (
            <span
              data-testid="stat-icon"
              className={`grid h-7 w-7 place-items-center rounded-full ${classes}`}
            >
              {iconNode}
            </span>
          )}
          <span className="min-w-0 text-sm font-medium leading-snug text-muted-foreground line-clamp-2">{title}</span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {loading ? (
            <span className="skeleton inline-block h-7 w-14 rounded" role="status" aria-label={`Loading ${title}`} />
          ) : (
            <span className="tabular text-[28px] font-bold leading-none tracking-tight text-foreground">
              {value}
            </span>
          )}
          {!loading && trend && <span className={`text-xs font-semibold ${trendTone}`}>{trend}</span>}
        </div>

        {description && !loading && (
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        )}
      </Card>
    </motion.div>
  );
};

export default StatCard;
