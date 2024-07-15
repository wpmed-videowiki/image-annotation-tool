import { ChevronRight } from "@mui/icons-material";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";

const OtherTools = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div>
      <Button
        id="basic-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        sx={{ textTransform: "capitalize" }}
      >
        Other Tools
        <ChevronRight sx={{ transform: "rotate(90deg)" }} />
      </Button>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem onClick={handleClose}>
          <a
            href="https://videowiki.wmcloud.org/"
            target="_blank"
            style={{ width: "100%", height: "100%" }}
          >
            VideoWiki
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a
            href="https://kenburnseffect-tool.wmcloud.org/"
            target="_blank"
            style={{ width: "100%", height: "100%" }}
          >
            Ken Burns Effect
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a
            href="https://osm-zoom-tool.wmcloud.org/"
            target="_blank"
            style={{ width: "100%", height: "100%" }}
          >
            OSM Zoom
          </a>
        </MenuItem>
      </Menu>
    </div>
  );
};

export default OtherTools;
