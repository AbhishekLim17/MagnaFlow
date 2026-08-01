import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { CheckSquare } from 'lucide-react';
import StatCard from './StatCard';

describe('StatCard', () => {
  test('renders its title and value', () => {
    render(<StatCard title="Total Tasks" value={42} />);
    expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  // Regression: lucide-react icons are forwardRef *objects*, not functions.
  // A `typeof icon === 'function'` check fell through and tried to render the
  // component object as a child, which threw and blanked the whole app.
  test('accepts a lucide icon passed as a component reference', () => {
    expect(() =>
      render(<StatCard title="Completed" value={1} icon={CheckSquare} />)
    ).not.toThrow();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('accepts an already-rendered icon element', () => {
    expect(() =>
      render(<StatCard title="Pending" value={2} icon={<CheckSquare />} />)
    ).not.toThrow();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  test('renders without an icon', () => {
    render(<StatCard title="Overdue" value={0} />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  // Colors must come from a static map — interpolated Tailwind classes are
  // invisible to the JIT compiler and render with no background at all.
  // The tone only paints the icon chip, so an icon is needed to see it.
  test('uses a known static class for a valid color', () => {
    render(<StatCard title="A" value={1} color="green" icon={CheckSquare} />);
    expect(screen.getByTestId('stat-icon')).toHaveClass('bg-success-soft');
  });

  test('falls back to the primary tone for an unknown color', () => {
    render(<StatCard title="B" value={1} color="not-a-color" icon={CheckSquare} />);
    // Falls back rather than emitting an undefined class.
    expect(screen.getByTestId('stat-icon')).toHaveClass('bg-primary-soft');
  });

  test('tints a rising trend as success and a falling one as danger', () => {
    render(<StatCard title="U" value={1} trend="+7% last month" />);
    expect(screen.getByText('+7% last month')).toHaveClass('text-success');

    render(<StatCard title="D" value={1} trend="-4% last month" />);
    expect(screen.getByText('-4% last month')).toHaveClass('text-destructive');
  });

  test('shows optional description and trend', () => {
    render(<StatCard title="X" value={5} description="since launch" trend="+3" />);
    expect(screen.getByText('since launch')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
});
