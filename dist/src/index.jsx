import React from "react";
import ReactDOM from "react-dom/client";
import Simulator from "./Simulator.jsx"; // the file you pasted into

console.log("index.jsx loaded");
document.getElementById("root").innerHTML = "<h1>Plain HTML works</h1>";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Simulator />
  </React.StrictMode>
);
