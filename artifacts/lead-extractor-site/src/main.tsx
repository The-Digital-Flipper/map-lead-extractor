import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Signals the boot diagnostic in index.html that the app started successfully.
(window as unknown as { __APP_MOUNTED__?: boolean }).__APP_MOUNTED__ = true;
