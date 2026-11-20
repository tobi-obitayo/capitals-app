import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {Analytics} from "@vercel/analytics/react";
import App from "./App";
import "./tw.css";   // also pulls in styles.css (as the "legacy" layer)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App/>
    <Analytics/>
  </StrictMode>,
);
