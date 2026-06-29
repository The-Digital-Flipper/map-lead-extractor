import { Component, type ReactNode } from "react";

// Root error boundary: turns any render / lazy-chunk crash into a visible,
// actionable message instead of a blank white screen, and logs the error.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surfaced in the browser console for debugging / monitoring hooks.
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117", color: "#e6edf3", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Something went wrong loading the app</h1>
            <p style={{ color: "#9aa4b2", marginBottom: "1rem" }}>Try reloading. If it persists, the message below tells us what to fix.</p>
            <pre style={{ whiteSpace: "pre-wrap", textAlign: "left", background: "#161c26", border: "1px solid #1e2a3a", borderRadius: 8, padding: "0.75rem", fontSize: "0.8rem", color: "#ff8a8a", overflow: "auto" }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button onClick={() => location.reload()} style={{ marginTop: "1rem", background: "#00E676", color: "#08110b", border: 0, borderRadius: 8, padding: "0.6rem 1.2rem", fontWeight: 700, cursor: "pointer" }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
