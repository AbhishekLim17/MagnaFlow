// ErrorBoundary - stops a render-time crash from blanking the entire app.
//
// React unmounts the whole tree when a component throws during render and no
// boundary catches it, which shows the user a blank page with no explanation.
// (A single bad icon prop did exactly that during development.) This renders a
// recoverable message instead and logs the error for diagnosis.

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureException } from '@/config/sentry';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Unhandled UI error:', error, errorInfo?.componentStack);
    // Forward to error tracking. Does nothing unless a Sentry DSN is
    // configured. Guarded because this is the last line of defence: if
    // reporting threw here, React would unmount the tree and the user would
    // get the blank page this component exists to prevent.
    try {
      captureException(error, { componentStack: errorInfo?.componentStack });
    } catch (reportingError) {
      console.error('Error reporting failed:', reportingError);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-900 text-white">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-6">
            This screen hit an unexpected error. Your data is safe — try again, or reload the page.
          </p>

          {import.meta.env.DEV && (
            <pre className="text-left text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded p-3 mb-6 overflow-auto max-h-40">
              {error.message}
            </pre>
          )}

          <div className="flex gap-2 justify-center">
            <Button onClick={this.handleReset} className="bg-indigo-600 hover:bg-indigo-700">
              Try again
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white"
              onClick={() => window.location.assign('/')}
            >
              Reload app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
