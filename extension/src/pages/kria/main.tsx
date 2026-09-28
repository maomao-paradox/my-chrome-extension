import React from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";

const root = document.getElementById("app") as HTMLElement;
const app = createRoot(root);
app.render(<App />);
