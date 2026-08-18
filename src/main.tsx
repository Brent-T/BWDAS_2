import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/* Surface runtime errors visually instead of dying into a white screen —
   critical inside embedded previews where devtools may be unavailable. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#12100d",
            color: "#f6f0e3",
            padding: "48px 32px",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <p style={{ color: "#e0a83f", fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>
            BWDAS workbench — render failed
          </p>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, margin: "12px 0 20px" }}>
            A runtime error was caught before it could blank the page
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#1c1813",
              border: "1px solid #352d22",
              borderRadius: 8,
              padding: 16,
              color: "#e8834a",
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            {String(this.state.error)}
            {"\n\n"}
            {this.state.error.stack ?? ""}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
