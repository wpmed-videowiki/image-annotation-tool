"use client";
import { createContext, useContext, useMemo } from "react";

import { getIn } from "../../utils/setIn";

// three contexts so dispatch consumers never re-render
const WizardStateContext = createContext(null);
const WizardDispatchContext = createContext(null);
const WizardErrorsContext = createContext({ errors: {}, touched: false });
// what the wizard is publishing; default matches the old video-only behavior
const WizardMediaContext = createContext({
  kind: "video",
  extensionChoices: ["webm"],
  defaultExtension: "webm",
});

export const WizardProvider = ({
  state,
  dispatch,
  errors,
  touched,
  media,
  children,
}) => {
  // keyed by field path so useFieldError is a plain lookup
  const errorMap = useMemo(() => {
    const map = {};
    for (const error of errors) {
      if (!map[error.field]) map[error.field] = error.code;
    }
    return map;
  }, [errors]);

  const errorValue = useMemo(
    () => ({ errors: errorMap, touched }),
    [errorMap, touched]
  );

  const mediaValue = useMemo(
    () =>
      media || { kind: "video", extensionChoices: ["webm"], defaultExtension: "webm" },
    [media]
  );

  return (
    <WizardStateContext.Provider value={state}>
      <WizardDispatchContext.Provider value={dispatch}>
        <WizardMediaContext.Provider value={mediaValue}>
          <WizardErrorsContext.Provider value={errorValue}>
            {children}
          </WizardErrorsContext.Provider>
        </WizardMediaContext.Provider>
      </WizardDispatchContext.Provider>
    </WizardStateContext.Provider>
  );
};

export const useWizardState = () => useContext(WizardStateContext);
export const useWizardDispatch = () => useContext(WizardDispatchContext);
export const useWizardMedia = () => useContext(WizardMediaContext);

export const useFieldError = (path) => {
  const { errors, touched } = useContext(WizardErrorsContext);
  return touched ? errors[path] : undefined;
};

// accessor used by every leaf field; radios use `select` so the reducer can
// cascade-clear the abandoned branch
export const useField = (path) => {
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const error = useFieldError(path);

  return {
    value: getIn(state.metadata, path),
    setValue: (value) => dispatch({ type: "SET_FIELD", path, value }),
    select: (value) => dispatch({ type: "SELECT_RIGHTS", path, value }),
    error,
  };
};

export default WizardProvider;
