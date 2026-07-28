// StatCard - the single stat/metric tile used across dashboards.
//
// Colors are looked up from a STATIC map on purpose: Tailwind's JIT compiler
// only sees class names that appear literally in the source, so interpolated
// classes like `bg-${color}` silently render with no background. StaffDashboard
// previously had exactly that bug.

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';

const COLOR_CLASSES = {
  green: 'text-green-400 bg-green-500/10 border-green-500/30',
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  red: 'text-red-400 bg-red-500/10 border-red-500/30',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  slate: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
  teal: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
};

/**
 * @param {string} title
 * @param {string|number} value
 * @param {ReactNode|Function} icon  a rendered node (<Icon />) or a component ref (Icon)
 * @param {string} color             key of COLOR_CLASSES
 * @param {string} [trend]           small note top-right
 * @param {string} [description]     small note under the title
 * @param {number} [index]           stagger index for entry animation
 */
const StatCard = ({ title, value, icon, color = 'blue', trend, description, index = 0 }) => {
  const classes = COLOR_CLASSES[color] || COLOR_CLASSES.blue;

  // Accept both an already-rendered node (<Icon />) and a bare component
  // reference (Icon). Note lucide-react icons are forwardRef *objects*, not
  // functions, so a `typeof === 'function'` test would wrongly fall through and
  // try to render a component object as a child (which crashes the tree).
  let iconNode = null;
  if (React.isValidElement(icon)) {
    iconNode = icon;
  } else if (icon) {
    iconNode = React.createElement(icon, { className: 'w-5 h-5' });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className={`glass-effect border ${classes} p-5 h-full`}>
        <div className="flex items-center justify-between mb-2">
          {iconNode && <div className={`p-2 rounded-lg ${classes}`}>{iconNode}</div>}
          {trend && <span className="text-xs text-gray-400">{trend}</span>}
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400">{title}</div>
        {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
      </Card>
    </motion.div>
  );
};

export default StatCard;
