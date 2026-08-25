// immutable get/set by dotted path ("describe.location.lat")
export const getIn = (object, path) =>
  path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), object);

export const setIn = (object, path, value) => {
  const [key, ...rest] = path.split(".");
  const child = rest.length ? setIn(object?.[key] ?? {}, rest.join("."), value) : value;
  if (Array.isArray(object)) {
    const next = object.slice();
    next[Number(key)] = child;
    return next;
  }
  return { ...object, [key]: child };
};
