import { fabric } from "fabric";

const DEFAULTS = { shape: "rect", effect: "blur", strength: 5 };
const MIN_DRAG_PX = 4;

function clampRect(rect, canvas) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(canvas.getWidth(), rect.left + rect.width);
  const bottom = Math.min(canvas.getHeight(), rect.top + rect.height);
  return { left, top, width: right - left, height: bottom - top };
}

function sampleRegion(canvas, rect) {
  canvas.renderAll();
  const scale = canvas.getRetinaScaling();
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.width));
  out.height = Math.max(1, Math.round(rect.height));
  out
    .getContext("2d")
    .drawImage(
      canvas.lowerCanvasEl,
      rect.left * scale,
      rect.top * scale,
      rect.width * scale,
      rect.height * scale,
      0,
      0,
      out.width,
      out.height
    );
  return out;
}

function applyEffect(source, { effect, strength }) {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (effect === "pixelate") {
    const block = Math.max(2, strength * 4);
    const smallW = Math.max(1, Math.ceil(source.width / block));
    const smallH = Math.max(1, Math.ceil(source.height / block));
    const small = document.createElement("canvas");
    small.width = smallW;
    small.height = smallH;
    small.getContext("2d").drawImage(source, 0, 0, smallW, smallH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, out.width, out.height);
  } else {
    ctx.filter = `blur(${strength * 2}px)`;
    ctx.drawImage(source, 0, 0);
  }
  return out;
}

function makeSnapshot(patch) {
  return {
    element: patch._element,
    left: patch.left,
    top: patch.top,
    width: patch.width,
    height: patch.height,
    hasClip: !!patch.clipPath,
    blurSettings: { ...patch.blurSettings },
  };
}

function applySnapshot(canvas, patch, snap) {
  patch.setElement(snap.element);
  patch.set({
    left: snap.left,
    top: snap.top,
    width: snap.width,
    height: snap.height,
    scaleX: 1,
    scaleY: 1,
  });
  patch.blurSettings = { ...snap.blurSettings };
  if (snap.hasClip) {
    patch.clipPath = new fabric.Ellipse({
      rx: snap.width / 2,
      ry: snap.height / 2,
      originX: "center",
      originY: "center",
    });
  }
  patch.dirty = true;
  patch.setCoords();
  canvas.renderAll();
}

function generatePatchPixels(canvas, rect, settings, excludeObjects) {
  excludeObjects.forEach((o) => (o.visible = false));
  try {
    // Pad the sampled area by the blur radius so the patch has no
    // transparent fringe, then crop back to the requested rect.
    const pad = settings.effect === "blur" ? settings.strength * 2 : 0;
    const padded = clampRect(
      {
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      },
      canvas
    );
    const sampled = sampleRegion(canvas, padded);
    const processed = applyEffect(sampled, settings);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(rect.width));
    out.height = Math.max(1, Math.round(rect.height));
    out
      .getContext("2d")
      .drawImage(
        processed,
        Math.round(rect.left - padded.left),
        Math.round(rect.top - padded.top),
        out.width,
        out.height,
        0,
        0,
        out.width,
        out.height
      );
    return out;
  } finally {
    excludeObjects.forEach((o) => (o.visible = true));
    canvas.renderAll();
  }
}

export default function initBlurTool(editor) {
  const canvas = editor._graphics.getCanvas();
  const state = {
    active: false,
    settings: { ...DEFAULTS },
    drawing: null,
  };

  const container = document.querySelector(".tui-image-editor-container");
  const menuBar = container.querySelector(".tui-image-editor-menu");

  // --- Menu button, matching tui's own <li> items ---
  const button = document.createElement("li");
  button.className = "tie-btn-blurTool tui-image-editor-item normal";
  button.setAttribute("tooltip-content", "Blur");
  button.innerHTML = `
    <svg class="blur-tool-icon" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 3 C12 3 6 10 6 14 a6 6 0 0 0 12 0 C18 10 12 3 12 3 Z"
        fill="none" stroke-width="1.5" />
    </svg>`;
  menuBar.appendChild(button);

  // --- Settings panel ---
  const panel = document.createElement("div");
  panel.className = "blur-tool-panel";
  panel.innerHTML = `
    <div class="blur-tool-group" data-setting="shape">
      <button type="button" data-value="rect" class="selected">Rectangle</button>
      <button type="button" data-value="ellipse">Ellipse</button>
    </div>
    <div class="blur-tool-group" data-setting="effect">
      <button type="button" data-value="blur" class="selected">Blur</button>
      <button type="button" data-value="pixelate">Pixelate</button>
    </div>
    <label class="blur-tool-strength">
      Strength
      <input type="range" min="1" max="10" step="1" value="${DEFAULTS.strength}" />
      <span class="blur-tool-strength-value">${DEFAULTS.strength}</span>
    </label>`;
  container.appendChild(panel);

  // One undo entry per slider drag, not per input tick: live-refresh on
  // "input", capture the pre-drag snapshot lazily, push the command on
  // "change" (fires once on release).
  let sliderBaseline = null;

  function onSettingsChange(changedKey) {
    if (changedKey === "shape") return; // shape applies to new patches only
    const obj = canvas.getActiveObject();
    if (obj && obj.isBlurPatch) {
      obj.blurSettings = {
        ...obj.blurSettings,
        effect: state.settings.effect,
        strength: state.settings.strength,
      };
      if (changedKey === "strength") {
        if (!sliderBaseline) {
          sliderBaseline = { patch: obj, snap: obj.__blurSnapshot };
        }
        refreshPatch(obj);
      } else {
        refreshPatchWithUndo(obj);
      }
    }
  }

  panel.querySelectorAll(".blur-tool-group").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn) return;
      group
        .querySelectorAll("button")
        .forEach((b) => b.classList.toggle("selected", b === btn));
      state.settings[group.dataset.setting] = btn.dataset.value;
      onSettingsChange(group.dataset.setting);
    });
  });

  const slider = panel.querySelector("input[type=range]");
  slider.addEventListener("input", () => {
    state.settings.strength = Number(slider.value);
    panel.querySelector(".blur-tool-strength-value").textContent = slider.value;
    onSettingsChange("strength");
  });
  slider.addEventListener("change", () => {
    const obj = canvas.getActiveObject();
    if (
      sliderBaseline &&
      obj &&
      obj.isBlurPatch &&
      sliderBaseline.patch === obj
    ) {
      const before = sliderBaseline.snap;
      const after = obj.__blurSnapshot;
      pushCommand(
        "blurPatchModify",
        () => applySnapshot(canvas, obj, after),
        () => applySnapshot(canvas, obj, before)
      );
    }
    sliderBaseline = null;
  });

  // --- Mode toggle ---
  function activate() {
    if (editor.ui.submenu) {
      editor.ui.changeMenu(editor.ui.submenu); // close open tui submenu
    }
    editor.stopDrawingMode();
    state.active = true;
    button.classList.add("active");
    panel.classList.add("visible");
    canvas.discardActiveObject();
    canvas.selection = false;
    canvas.defaultCursor = "crosshair";
    canvas.forEachObject((o) => {
      o.__blurPrevSelectable = o.selectable;
      o.__blurPrevEvented = o.evented;
      o.selectable = !!o.isBlurPatch;
      o.evented = !!o.isBlurPatch;
    });
    canvas.renderAll();
  }

  function deactivate() {
    state.active = false;
    button.classList.remove("active");
    panel.classList.remove("visible");
    canvas.selection = true;
    canvas.defaultCursor = "default";
    canvas.forEachObject((o) => {
      if (o.__blurPrevSelectable !== undefined) {
        o.selectable = o.__blurPrevSelectable;
        o.evented = o.__blurPrevEvented;
        delete o.__blurPrevSelectable;
        delete o.__blurPrevEvented;
      }
    });
    canvas.renderAll();
  }

  // Hand-crafted commands pushed through tui's invoker so the editor's own
  // Undo/Redo buttons handle blur patches. The invoker calls execute() on
  // redo and undo() on undo, both must return promises.
  function pushCommand(name, executeFn, undoFn) {
    editor._invoker.pushUndoStack({
      name,
      args: [],
      undoData: {},
      executeCallback: null,
      undoCallback: null,
      execute: () => Promise.resolve().then(executeFn),
      undo: () => Promise.resolve().then(undoFn),
    });
    // invoker.execute() clears the redo stack for native commands; our
    // pushUndoStack bypasses that, so clear it explicitly.
    editor.clearRedoStack();
  }

  function removePatch(patch) {
    if (canvas.getActiveObject() === patch) {
      canvas.discardActiveObject();
    }
    canvas.remove(patch);
    canvas.renderAll();
  }

  function createPatch(rect, settings) {
    const pixels = generatePatchPixels(canvas, rect, settings, []);
    const patch = new fabric.Image(pixels, {
      left: rect.left,
      top: rect.top,
      selectable: true,
      evented: true,
      lockRotation: true,
    });
    patch.setControlsVisibility({ mtr: false });
    patch.isBlurPatch = true;
    patch.blurSettings = { ...settings };
    if (settings.shape === "ellipse") {
      patch.clipPath = new fabric.Ellipse({
        rx: pixels.width / 2,
        ry: pixels.height / 2,
        originX: "center",
        originY: "center",
      });
    }
    canvas.add(patch);
    canvas.renderAll();
    patch.__blurSnapshot = makeSnapshot(patch);
    const snap = patch.__blurSnapshot;
    pushCommand(
      "blurPatchAdd",
      () => {
        canvas.add(patch);
        applySnapshot(canvas, patch, snap);
      },
      () => removePatch(patch)
    );
    return patch;
  }

  function refreshPatch(patch) {
    const rect = clampRect(
      {
        left: patch.left,
        top: patch.top,
        width: patch.getScaledWidth(),
        height: patch.getScaledHeight(),
      },
      canvas
    );
    try {
      const pixels = generatePatchPixels(canvas, rect, patch.blurSettings, [patch]);
      patch.setElement(pixels);
      patch.set({
        left: rect.left,
        top: rect.top,
        width: pixels.width,
        height: pixels.height,
        scaleX: 1,
        scaleY: 1,
      });
      if (patch.clipPath) {
        patch.clipPath = new fabric.Ellipse({
          rx: pixels.width / 2,
          ry: pixels.height / 2,
          originX: "center",
          originY: "center",
        });
      }
      // fabric's setElement and direct clipPath assignment don't invalidate
      // the object cache — without this the old pixels keep rendering.
      patch.dirty = true;
      patch.setCoords();
      canvas.renderAll();
      patch.__blurSnapshot = makeSnapshot(patch);
      return true;
    } catch (err) {
      // Never silently drop a redaction — keep the existing patch on failure.
      console.error("Blur patch refresh failed", err);
      return false;
    }
  }

  function refreshPatchWithUndo(patch) {
    const before = patch.__blurSnapshot;
    if (refreshPatch(patch)) {
      const after = patch.__blurSnapshot;
      pushCommand(
        "blurPatchModify",
        () => applySnapshot(canvas, patch, after),
        () => applySnapshot(canvas, patch, before)
      );
    }
  }

  const PREVIEW_STYLE = {
    fill: "rgba(64, 128, 255, 0.25)",
    stroke: "#4080ff",
    strokeDashArray: [4, 4],
    strokeWidth: 1,
    selectable: false,
    evented: false,
  };

  canvas.on("mouse:down", (opt) => {
    if (!state.active || opt.target) return; // clicks on patches → fabric selection
    const p = canvas.getPointer(opt.e);
    const shape =
      state.settings.shape === "ellipse"
        ? new fabric.Ellipse({ ...PREVIEW_STYLE, left: p.x, top: p.y, rx: 0, ry: 0 })
        : new fabric.Rect({ ...PREVIEW_STYLE, left: p.x, top: p.y, width: 0, height: 0 });
    state.drawing = { startX: p.x, startY: p.y, shape };
    canvas.add(shape);
  });

  canvas.on("mouse:move", (opt) => {
    if (!state.active || !state.drawing) return;
    const p = canvas.getPointer(opt.e);
    const { startX, startY, shape } = state.drawing;
    const left = Math.min(startX, p.x);
    const top = Math.min(startY, p.y);
    const w = Math.abs(p.x - startX);
    const h = Math.abs(p.y - startY);
    if (shape.type === "ellipse") {
      shape.set({ left, top, rx: w / 2, ry: h / 2 });
    } else {
      shape.set({ left, top, width: w, height: h });
    }
    canvas.renderAll();
  });

  canvas.on("mouse:up", (opt) => {
    if (!state.active || !state.drawing) return;
    const p = canvas.getPointer(opt.e);
    const { startX, startY, shape } = state.drawing;
    state.drawing = null;
    canvas.remove(shape);
    const rect = clampRect(
      {
        left: Math.min(startX, p.x),
        top: Math.min(startY, p.y),
        width: Math.abs(p.x - startX),
        height: Math.abs(p.y - startY),
      },
      canvas
    );
    if (rect.width < MIN_DRAG_PX || rect.height < MIN_DRAG_PX) {
      canvas.renderAll();
      return;
    }
    createPatch(rect, state.settings);
  });

  canvas.on("object:modified", (opt) => {
    const obj = opt.target;
    if (obj && obj.isBlurPatch) {
      refreshPatchWithUndo(obj);
    }
  });

  const onKeyDown = (e) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (!canvas.lowerCanvasEl.isConnected) {
      // Editor DOM was torn down (image changed) — retire this listener.
      document.removeEventListener("keydown", onKeyDown);
      return;
    }
    const obj = canvas.getActiveObject();
    if (obj && obj.isBlurPatch) {
      const snap = obj.__blurSnapshot;
      removePatch(obj);
      pushCommand(
        "blurPatchRemove",
        () => removePatch(obj),
        () => {
          canvas.add(obj);
          applySnapshot(canvas, obj, snap);
        }
      );
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  button.addEventListener("click", () => {
    state.active ? deactivate() : activate();
  });

  // Opening any tui menu exits blur mode.
  menuBar.addEventListener("click", (e) => {
    const item = e.target.closest(".tui-image-editor-item");
    if (item && item !== button && state.active) {
      deactivate();
    }
  });
}
