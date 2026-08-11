export const initialOpsState = {
  past: [],
  present: {
    rotation: 0, // 0 | 90 | 180 | 270, clockwise
    trim: null, // { start, end } in seconds, or null for full length
    crop: null, // { x, y, w, h } normalized 0..1 in rotated-frame coords, or null
    mute: false,
  },
  future: [],
};

export function opsReducer(state, action) {
  switch (action.type) {
    case "APPLY":
      return {
        past: [...state.past, state.present],
        present: { ...state.present, ...action.payload },
        future: [],
      };
    case "UNDO": {
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }
    case "RESET":
      return {
        past: [...state.past, state.present],
        present: initialOpsState.present,
        future: [],
      };
    default:
      return state;
  }
}
