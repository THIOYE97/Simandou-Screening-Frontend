// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { SettingsProvider } from "./SettingsContext";
import App from "./App";
import "./styles.css";
import "./ui/theme.css";
import { UIProvider } from "./ui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>
);