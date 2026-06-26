import { Commands, ROUTE_TO_CONTENT } from "./src/messages.js";

const status = document.getElementById("status");
const openPanel = document.getElementById("openPanel");
const openBing = document.getElementById("openBing");

async function sendToContent(command, payload = {}) {
  return chrome.runtime.sendMessage({
    type: ROUTE_TO_CONTENT,
    payload: { command, ...payload }
  });
}

openPanel.addEventListener("click", async () => {
  status.textContent = "Opening extractor...";
  const response = await sendToContent(Commands.SHOW_PANEL);
  if (response?.ok) {
    status.textContent = "Extractor opened on Google Maps.";
    window.close();
    return;
  }
  status.textContent = response?.error || "Could not open extractor.";
});

openBing.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://www.google.com/maps/search/food+in+Dallas" });
  window.close();
});

