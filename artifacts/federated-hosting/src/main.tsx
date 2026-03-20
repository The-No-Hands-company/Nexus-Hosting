import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n"; // initialise i18next before first render

createRoot(document.getElementById("root")!).render(<App />);
