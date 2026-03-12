import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unexpected application error"
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Unhandled app error:", error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-danger/40 bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold text-danger">Application Error</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The UI crashed while rendering. Check the browser console for the full stack trace.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
            {this.state.message}
          </pre>
          <button
            type="button"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
