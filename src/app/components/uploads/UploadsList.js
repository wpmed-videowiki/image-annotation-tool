"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Add, Replay } from "@mui/icons-material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import {
  cancelJob,
  listMyJobs,
  retryAllFailed,
  retryJob,
  setJobArchived,
} from "../../actions/jobs";
import { ALL_STATUSES } from "../../utils/jobStatus";
import JobRow from "./JobRow";

const POLL_INTERVAL_MS = 5000;

const UploadsList = ({ initial, initialFilters }) => {
  const t = useTranslations("Uploads");
  const router = useRouter();

  const [archived, setArchived] = useState(!!initialFilters.archived);
  const [status, setStatus] = useState(initialFilters.status || "");
  const [page, setPage] = useState(initialFilters.page || 1);
  const [data, setData] = useState(initial);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [retryingAll, setRetryingAll] = useState(false);
  const firstRender = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await listMyJobs({ archived, status, page });
      setData(next);
    } catch (err) {
      console.log(err);
    }
  }, [archived, status, page]);

  // filters -> fetch (+ mirror into the URL so a reload keeps them)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (archived) params.set("archived", "1");
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/uploads?${query}` : "/uploads", { scroll: false });
    refresh();
  }, [archived, status, page, refresh, router]);

  // live progress only while needed
  useEffect(() => {
    if (!data.hasActive) return undefined;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [data.hasActive, refresh]);

  const withBusy = async (id, fn) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const response = await fn();
      if (response?.error) {
        toast.error(t.has(`errors.${response.error}`) ? t(`errors.${response.error}`) : response.error);
      }
      return response;
    } catch (err) {
      console.log(err);
      return null;
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refresh();
    }
  };

  const onAction = (job, action) => {
    if (action === "cancel") {
      return withBusy(job.id, async () => {
        const response = await cancelJob(job.id);
        if (response?.ok) {
          toast.info(response.pending ? t("toast.cancel_requested") : t("toast.cancelled"));
        }
        return response;
      });
    }
    if (action === "retry") {
      return withBusy(job.id, async () => {
        const response = await retryJob(job.id);
        if (response?.ok) toast.success(t("toast.retried"));
        return response;
      });
    }
    const nextArchived = action === "archive";
    return withBusy(job.id, async () => {
      const response = await setJobArchived(job.id, nextArchived);
      if (response?.ok) {
        // drop the row now, the refresh confirms it
        setData((prev) => ({
          ...prev,
          jobs: prev.jobs.filter((entry) => entry.id !== job.id),
        }));
        toast.success(t(nextArchived ? "toast.archived" : "toast.unarchived"));
      }
      return response;
    });
  };

  const onRetryAll = async () => {
    setRetryingAll(true);
    try {
      const response = await retryAllFailed();
      if (response?.error) {
        toast.error(t.has(`errors.${response.error}`) ? t(`errors.${response.error}`) : response.error);
      } else {
        toast.success(t("toast.retry_all_done", { count: response.retried }));
        for (const skipped of response.skipped || []) {
          if (t.has(`errors.${skipped.error}`)) toast.warn(t(`errors.${skipped.error}`));
        }
      }
    } finally {
      setRetryingAll(false);
      refresh();
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.perPage));
  const hasFailed = data.jobs.some((job) => job.status === "error");
  const emptyKey = status ? "empty_filtered" : archived ? "empty_archived" : "empty_recent";

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h5" component="h1">
          {t("title")}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={archived ? "archived" : "recent"}
            onChange={(event, value) => {
              if (!value) return;
              setArchived(value === "archived");
              setPage(1);
            }}
          >
            <ToggleButton value="recent">{t("recent")}</ToggleButton>
            <ToggleButton value="archived">{t("archived")}</ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="uploads-status-label">{t("filter_status")}</InputLabel>
            <Select
              labelId="uploads-status-label"
              label={t("filter_status")}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">{t("filter_all")}</MenuItem>
              {ALL_STATUSES.map((entry) => (
                <MenuItem key={entry} value={entry}>
                  {t(`status.${entry}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {hasFailed && !archived && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Replay />}
              disabled={retryingAll}
              onClick={onRetryAll}
            >
              {t("actions.retry_all_failed")}
            </Button>
          )}
          <Button component={Link} href="/" size="small" variant="contained" startIcon={<Add />}>
            {t("new_upload")}
          </Button>
        </Stack>
      </Stack>

      {data.jobs.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 8 }}>
          <Typography color="text.secondary">{t(emptyKey)}</Typography>
        </Stack>
      ) : (
        <Grid container spacing={2}>
          {data.jobs.map((job) => (
            <Grid key={job.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <JobRow
                job={job}
                busy={busyIds.has(job.id)}
                onAction={(action) => onAction(job, action)}
                onChanged={refresh}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center">
          <Pagination
            count={totalPages}
            page={Math.min(page, totalPages)}
            onChange={(event, value) => setPage(value)}
          />
        </Stack>
      )}
    </Stack>
  );
};

export default UploadsList;
