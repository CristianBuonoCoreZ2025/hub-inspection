"use client";

import React from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("React component error", error, {
      component: "ErrorBoundary",
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-heading text-destructive">
                Algo salió mal
              </CardTitle>
              <CardDescription>
                Ocurrió un error inesperado. Intenta recargar la página.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <pre className="rounded-lg bg-muted p-4 text-xs overflow-auto max-h-60">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                Recargar página
              </Button>
              <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
                Intentar de nuevo
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
