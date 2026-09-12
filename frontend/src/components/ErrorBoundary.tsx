import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                System Recovering
              </h1>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                An unexpected rendering error occurred. The application has caught the exception to protect your data.
              </p>
            </div>
            
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button 
                variant="outline" 
                className="w-full sm:w-auto gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
              <Link to="/" className="w-full sm:w-auto">
                <Button className="w-full gap-2">
                  <Home className="w-4 h-4" />
                  Return Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
