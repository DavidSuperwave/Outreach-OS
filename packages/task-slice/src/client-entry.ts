import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { LiveOutreach } from "./client-hydrate.js";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(createElement(LiveOutreach));
}
