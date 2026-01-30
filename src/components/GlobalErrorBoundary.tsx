import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorDisplay } from './ErrorDisplay';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleClose = () => {
        // For a global error, "closing" usually means either resetting the boundary
        // to try again, or reloading the page.
        // Let's try resetting first. If the error persists immediately, the user might get stuck,
        // so we might want to offer a reload option eventually, but let's stick to reset for now.
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorDisplay
                    error={this.state.error}
                    context={{
                        stage: 'Global App Crash',
                        rawError: this.state.error
                    }}
                    onClose={this.handleClose}
                />
            );
        }

        return this.props.children;
    }
}
