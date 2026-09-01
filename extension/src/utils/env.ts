export const isContentScript = () => {
  return (
    typeof chrome !== "undefined" &&
    chrome.runtime?.id &&
    !window.location.protocol.startsWith("chrome-extension:")
  );
};
