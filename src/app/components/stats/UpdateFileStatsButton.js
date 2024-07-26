"use client";

import { Tooltip, IconButton, CircularProgress } from "@mui/material";
import { Refresh } from "@mui/icons-material";
import { useState } from "react";
import { getFileUsageOnAllWikis } from "../../actions/stats";

const UpdateFileStatsButton = ({ id, statsLastUpdatedAt, status }) => {
  const [loading, setLoading] = useState(false);

  const onUpdateFileStats = async () => {
    setLoading(true);
    try {
      await getFileUsageOnAllWikis(id);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  const diabled = new Date(statsLastUpdatedAt);

  return (
    <Tooltip title="Update File Usage Stats">
      <IconButton onClick={onUpdateFileStats}>
        {loading || status === "processing" ? (
          <CircularProgress size={20} />
        ) : (
          <Refresh />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default UpdateFileStatsButton;
