import React from "react";
import ReactDOM from "react-dom/client";
import Simulator from "./Simulator.jsx";

console.log("[index] loaded");

const rootEl = document.getElementById("root");
if (!rootEl) {
  const el = document.createElement("div");
  el.id = "root";
  document.body.appendChild(el);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Simulator />
  </React.StrictMode>
);