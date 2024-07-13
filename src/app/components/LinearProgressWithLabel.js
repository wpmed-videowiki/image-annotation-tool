import { Box, LinearProgress, Typography } from "@mui/material";

const LinearProgressWithLabel = (props) => {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box sx={{ width: "100%", mr: 1 }}>
        <LinearProgress variant="determinate" {...props} />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography variant="body2" color="white">{`${Math.round(
          props.value
        )}%`}</Typography>
      </Box>
    </Box>
  );
};

export default LinearProgressWithLabel;
