import {
  Card,
  CardContent,
  Container,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { getStats, getTotalUsers } from "../actions/stats";
import FileRow from "../components/stats/FileRow";

const MIN_ROWS = 12;

const StatsPage = async ({ searchParams }) => {
  const [stats, totalUsers] = await Promise.all([
    getStats(searchParams.page ? parseInt(searchParams.page) : 1),
    getTotalUsers(),
  ]);

  const uploadsJSON = stats.uploads.map((upload) =>
    JSON.parse(JSON.stringify(upload.toJSON()))
  );

  return (
    <Container maxWidth="xl">
      <Grid container columnSpacing={4} rowSpacing={4}>
        <Grid item xs={12} md={2}>
          <Stack spacing={2}>
            <Card sx={{ maxWidth: 300, textAlign: "center" }}>
              <CardContent>
                <Typography variant="h6">{stats.totalUploads}</Typography>
                <Typography variant="h5">Uploads</Typography>
              </CardContent>
            </Card>
            <Card sx={{ maxWidth: 300, textAlign: "center" }}>
              <CardContent>
                <Typography variant="h6">{totalUsers}</Typography>
                <Typography variant="h5">Total Users</Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={12} md={10}>
          <Paper sx={{ p: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>File Name</TableCell>
                  <TableCell>Pages using file</TableCell>
                  <TableCell>Total page views</TableCell>
                  <TableCell>Uploaded At</TableCell>
                  <TableCell>Stats Updated at</TableCell>
                  <TableCell>Link</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadsJSON.map((upload) => (
                  <FileRow upload={upload} key={upload._id} />
                ))}
                {uploadsJSON.length < MIN_ROWS &&
                  Array.from({ length: MIN_ROWS - uploadsJSON.length }).map(
                    (_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={7} />
                      </TableRow>
                    )
                  )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default StatsPage;
