import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Prevents a thrown render from white-screening the whole app; offers a reload. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="empty" style={{ maxWidth: 480, margin: '18vh auto' }}>
          <div className="big">😵</div>
          <h2>Something went wrong.</h2>
          <p className="hint">{this.state.error.message}</p>
          <button className="primary" style={{ marginTop: 16 }} onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
