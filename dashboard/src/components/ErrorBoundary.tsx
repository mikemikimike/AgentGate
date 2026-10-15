import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Telemetry view crash caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg">
          <div className="border border-bad/30 bg-bad/10 rounded-lg p-6 max-w-md w-full text-left">
            <div className="flex items-center gap-2 text-bad text-[13px] font-mono font-medium mb-2">
              <span className="w-2 h-2 rounded-full bg-bad animate-pulse" />
              <span>TELEMETRY_RENDER_ERROR</span>
            </div>
            <p className="text-t2 text-[12px] font-mono break-words mb-4">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-3 py-1.5 rounded bg-bad/20 hover:bg-bad/30 text-bad text-[12px] font-medium transition-colors"
            >
              Reload dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
