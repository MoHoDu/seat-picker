import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app/App";
import "./ui/app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
