
document.getElementById("go-to-options").addEventListener("click", () => {
    console.log("Click event!");
    window.open("hsabook_options.html");
})
document.getElementById("go-to-options").onClick = () => {
  window.open("hsabook_options.html");
  return;
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('hsabook_options.html'));
    window.open("hsabook_options.html");
  }
};