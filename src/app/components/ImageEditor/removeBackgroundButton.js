// tui menu item, added the way blurTool.js adds its Blur button.
const ICON = `
  <svg class="remove-background-icon" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke-dasharray="2.5 2" />
    <circle cx="12" cy="9.5" r="2.75" />
    <path d="M7.5 18c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5" />
  </svg>`;

export default function initRemoveBackgroundButton(editor, { label, onClick }) {
  const container = document.querySelector(".tui-image-editor-container");
  const menuBar = container && container.querySelector(".tui-image-editor-menu");
  if (!menuBar) {
    console.error("remove background: tui menu bar not found");
    return { setDisabled() {}, destroy() {} };
  }

  const button = document.createElement("li");
  button.className = "tie-btn-removeBackground tui-image-editor-item normal";
  button.setAttribute("tooltip-content", label);
  button.innerHTML = ICON;

  let disabled = false;
  const handleClick = () => {
    if (disabled) return;
    // leave any open tui submenu (crop, draw, ...) before the dialog opens
    if (editor.ui.submenu) {
      editor.ui.changeMenu(editor.ui.submenu);
    }
    editor.stopDrawingMode();
    onClick();
  };
  button.addEventListener("click", handleClick);
  menuBar.appendChild(button);

  return {
    setDisabled(value, tooltip) {
      disabled = !!value;
      button.classList.toggle("disabled", disabled);
      button.setAttribute("tooltip-content", (disabled && tooltip) || label);
    },
    destroy() {
      button.removeEventListener("click", handleClick);
      button.remove();
    },
  };
}
