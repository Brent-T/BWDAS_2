import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

/* The app is loaded through a DYNAMIC import inside a try/catch so that even
   a module-evaluation failure anywhere in the graph is caught and rendered
   visibly — instead of dying into a black screen with no feedback. */

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
      return <Diagnostic title="Render-phase error caught" error={this.state.error} />;
    }
    return this.props.children;
  }
}

function Diagnostic({ title, error }: { title: string; error: unknown }) {
  const err = error as Error | undefined;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#12100d",
        color: "#f6f0e3",
        padding: "48px 32px",
        fontFamily: "'JetBrains Mono', Consolas, monospace",
      }}
    >
      <p style={{ color: "#e0a83f", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
        BWDAS workbench — boot diagnostic
      </p>
      <h1 style={{ fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif", fontSize: 24, margin: "12px 0 20px" }}>
        {title}
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
          margin: 0,
        }}
      >
        {String(err)}
        {"\n\n"}
        {err && err.stack ? err.stack : ""}
      </pre>
    </div>
  );
}

async function bootstrap() {
  const el = document.getElementById("root");
  if (!el) return;
  const root = ReactDOM.createRoot(el);
  try {
    const { default: App } = await import("./App");
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err) {
    root.render(<Diagnostic title="The app module failed to load" error={err} />);
  }
}

void bootstrap();
