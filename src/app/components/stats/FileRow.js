"use client";
import {
  CircularProgress,
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
} from "@mui/material";
import {
  getFileUploadByIdLight,
  getFileUsageOnAllWikis,
} from "../../actions/stats";
import Link from "next/link";
import { OpenInNew, Refresh } from "@mui/icons-material";
import { useEffect, useState } from "react";

const FileRow = ({ upload }) => {
  const [loading, setLoading] = useState(false);
  const [internalUpload, setInternalUpload] = useState(upload);

  const onUpdateFileStats = async () => {
    console.log("updating stats");
    setLoading(true);
    try {
      await getFileUsageOnAllWikis(internalUpload._id);
      const res = await getFileUploadByIdLight(internalUpload._id);
      setInternalUpload(res);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (internalUpload.statsStatus === "processing") {
      const interval = setInterval(() => {
        async function fetchInternalUpload() {
          const res = await getFileUploadByIdLight(internalUpload._id);
          if (res) {
            if (res.statsStatus === "done") {
              clearInterval(interval);
            }
            setInternalUpload(res);
          }
        }
        fetchInternalUpload();
      }, 2000);

      return () => clearInterval(interval);
    }
    return () => {};
  }, [internalUpload]);

  return (
    <TableRow>
      <TableCell>
        <Link href={`/stats/${internalUpload._id}`}>
          {internalUpload.fileName.length > 30 ? (
            <Tooltip title={internalUpload.fileName}>
              <span>{internalUpload.fileName.slice(0, 30)}...</span>
            </Tooltip>
          ) : (
            internalUpload.fileName
          )}
        </Link>
      </TableCell>
      <TableCell>{internalUpload.numberOfLinkedPages || 0}</TableCell>
      <TableCell>{internalUpload.linkedPagesViews}</TableCell>
      <TableCell>{new Date(internalUpload.createdAt).toDateString()}</TableCell>
      <TableCell>
        {new Date(internalUpload.statsLastUpdatedAt).toDateString()}
      </TableCell>
      <TableCell>
        <a
          href={internalUpload.url}
          target="_blank"
          style={{ textDecoration: "underline" }}
        >
          <OpenInNew />
        </a>
      </TableCell>
      <TableCell>
        <Tooltip title="Update File Usage Stats">
          <IconButton
            onClick={onUpdateFileStats}
            disabled={loading || internalUpload.statsStatus === "processing"}
          >
            {loading || internalUpload.statsStatus === "processing" ? (
              <CircularProgress size={20} />
            ) : (
              <Refresh />
            )}
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

export default FileRow;
