/**
 * main.tsx:
 *   - Uses createRoot() to mount the app into the <div id="root"> element defined in index.html.
 *   - Wraps the app in <StrictMode> so React will:
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
