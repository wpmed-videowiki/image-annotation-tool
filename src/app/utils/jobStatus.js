// Job status vocabulary shared by the worker, the server actions and the
// client. No imports on purpose: this file must load from
// bare-Node workers and from client components alike.

export const RUNNING_STATUSES = [
  "downloading",
  "processing",
  "uploading",
  "publishing",
];
export const ACTIVE_STATUSES = ["queued", ...RUNNING_STATUSES];
export const TERMINAL_STATUSES = ["done", "error", "cancelled"];
export const ALL_STATUSES = [...ACTIVE_STATUSES, ...TERMINAL_STATUSES];

export const isActive = (status) => ACTIVE_STATUSES.includes(status);

export const canCancel = (job) =>
  isActive(job?.status) && !job?.cancelRequested;

export const canRetry = (job) =>
  job?.status === "error" || job?.status === "cancelled";

export const canArchive = (job) => TERMINAL_STATUSES.includes(job?.status);

// visual bucket for a StatusChip
export const statusChipKind = (status) => {
  if (status === "queued") return "queued";
  if (RUNNING_STATUSES.includes(status)) return "running";
  if (status === "done") return "done";
  if (status === "cancelled") return "cancelled";
  return "error";
};

// applied on retry: same document, back to the front of its own history
export const RETRY_RESET_FIELDS = {
  status: "queued",
  stage: "",
  progress: 0,
  error: "",
  errorDetail: "",
  result: null,
  sdc: null,
  cancelRequested: false,
  archived: false,
};

// error codes src/app/actions/jobs.js can return (plus the session ones);
// test/messages.test.mjs checks each has an Uploads.errors.* string
export const JOB_ACTION_ERRORS = [
  "not_found",
  "not_cancellable",
  "not_retryable",
  "not_archivable",
  "source_expired",
  "not_authenticated",
  "provider_not_linked",
  "reauth_required",
];
