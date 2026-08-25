import {
  EMPTY_METADATA,
  normalizeUploadMetadata,
} from "../../utils/uploadMetadata.js";
import { getIn, setIn } from "../../utils/setIn.js";
import { descendantPaths, getPath, RIGHTS_TREE } from "./config/rightsTree.js";

export const STEPS = ["edit", "rights", "describe", "review"];

let rowKey = 0;
// stable keys for repeatable rows, index keys lose focus on removal
export const nextRowKey = () => `row-${(rowKey += 1)}`;

export const createInitialState = (
  prefill = {},
  locale = "en",
  { extension = "webm" } = {}
) => {
  const metadata = EMPTY_METADATA();
  metadata.describe.captions = [{ key: nextRowKey(), lang: locale, text: "" }];
  metadata.describe.descriptions = [{ key: nextRowKey(), lang: locale, text: "" }];

  return {
    step: 0,
    maxVisitedStep: 0,
    // errors stay hidden until the user tries to advance
    touched: { edit: false, rights: false, describe: false, review: false },
    metadata,
    publish: { comment: "", wikitext: "", wikitextEdited: false, extension },
    // set once from page.js
    hydrated: false,
    prefill,
  };
};

// clear the abandoned subtree so stale answers don't poison validation
const clearBranch = (metadata, node, keepPath) => {
  let next = metadata;
  for (const path of descendantPaths(node)) {
    if (path === keepPath) continue;
    const current = getIn(next, path);
    const empty = Array.isArray(current) ? [] : typeof current === "boolean" ? false : "";
    next = setIn(next, path, empty);
  }
  return next;
};

const findNodeByPath = (path, node = RIGHTS_TREE) => {
  if (node.path === path) return node;
  for (const option of node.options || []) {
    for (const child of option.children || []) {
      const found = findNodeByPath(path, child);
      if (found) return found;
    }
  }
  for (const child of node.children || []) {
    const found = findNodeByPath(path, child);
    if (found) return found;
  }
  return null;
};

export const wizardReducer = (state, action) => {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, metadata: setIn(state.metadata, action.path, action.value) };

    case "SELECT_RIGHTS": {
      const node = findNodeByPath(action.path);
      let metadata = setIn(state.metadata, action.path, action.value);
      if (node) metadata = clearBranch(metadata, node, action.path);
      return { ...state, metadata };
    }

    case "ROW_ADD":
      return {
        ...state,
        metadata: setIn(state.metadata, action.path, [
          ...getIn(state.metadata, action.path),
          { key: nextRowKey(), lang: action.lang || "en", text: "" },
        ]),
      };

    case "ROW_SET": {
      const rows = getIn(state.metadata, action.path).slice();
      rows[action.index] = { ...rows[action.index], ...action.value };
      return { ...state, metadata: setIn(state.metadata, action.path, rows) };
    }

    case "ROW_REMOVE": {
      const rows = getIn(state.metadata, action.path).filter(
        (_, i) => i !== action.index
      );
      return { ...state, metadata: setIn(state.metadata, action.path, rows) };
    }

    case "SET_PUBLISH":
      return { ...state, publish: { ...state.publish, ...action.value } };

    case "TOUCH_STEP":
      return {
        ...state,
        touched: { ...state.touched, [STEPS[action.step ?? state.step]]: true },
      };

    case "GOTO_STEP": {
      const step = Math.max(0, Math.min(STEPS.length - 1, action.step));
      return {
        ...state,
        step,
        maxVisitedStep: Math.max(state.maxVisitedStep, step),
      };
    }

    case "HYDRATE": {
      if (state.hydrated) return state;
      const metadata = action.metadata || state.metadata;
      return { ...state, metadata, hydrated: true };
    }

    default:
      return state;
  }
};

// strip the React `key` the validator doesn't know about
export const toMetadata = (state) => ({
  ...state.metadata,
  describe: {
    ...state.metadata.describe,
    captions: state.metadata.describe.captions.map(({ lang, text }) => ({ lang, text })),
    descriptions: state.metadata.describe.descriptions.map(({ lang, text }) => ({
      lang,
      text,
    })),
  },
});

export const validateStep = (state, step) => {
  const name = STEPS[step];
  if (name === "edit") return []; // editing has no metadata to validate
  const { errors } = normalizeUploadMetadata(toMetadata(state), {
    extension: state.publish.extension,
  });
  if (name === "review") return errors;
  return errors.filter((error) => error.field.startsWith(name));
};

export { getPath };
