import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../appearance";
import { preferencesStore } from "../preferences";
import App from "./App";
import "./styles.css";

async function start(): Promise<void> {
  const preferences = await preferencesStore.load();
  applyTheme(preferences.theme, false);
  document.documentElement.lang = preferences.locale;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App initialPreferences={preferences} />
    </StrictMode>
  );
}

void start();
