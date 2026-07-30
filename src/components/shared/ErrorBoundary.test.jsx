import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

const captureException = vi.fn();
vi.mock('@/config/sentry', () => ({
  captureException: (...args) => captureException(...args),
}));

const Boom = () => {
  throw new Error('kaboom');
};

describe('ErrorBoundary', () => {
  let consoleError;
  beforeEach(() => {
    // React logs the caught error; keep the test output readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureException.mockClear();
  });
  afterEach(() => consoleError.mockRestore());

  test('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  test('shows a recovery screen instead of a blank page when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument();
  });

  test('reports the error for tracking', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  // If reporting could throw, the boundary would fail while handling a failure
  // and the user would get the blank page it exists to prevent.
  test('still renders the recovery screen if error reporting throws', () => {
    captureException.mockImplementationOnce(() => {
      throw new Error('sentry is down');
    });
    expect(() =>
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      )
    ).not.toThrow();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
