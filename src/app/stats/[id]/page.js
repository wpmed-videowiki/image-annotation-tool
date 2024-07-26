import {
  Grid,
  Container,
  Stack,
  IconButton,
  Typography,
  Card,
  CardContent,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  Box,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { getFileUploadById } from "../../actions/stats";
import { notFound } from "next/navigation";
import { ArrowBack, OpenInNew } from "@mui/icons-material";
import Link from "next/link";

const FileStatsPage = async ({ params }) => {
  const upload = await getFileUploadById(params.id);

  if (!upload) {
    return notFound();
  }

  const pages = {};
  const totalViews = {};
  upload.linkedPages.forEach((page) => {
    if (!pages[page.wiki]) {
      pages[page.wiki] = [];
    }
    if (!totalViews[page.wiki]) {
      totalViews[page.wiki] = 0;
    }
    pages[page.wiki] = pages[page.wiki].concat(page.result);
    totalViews[page.wiki] += page.result.reduce(
      (acc, item) => acc + item.views,
      0
    );
  });

  return (
    <Container maxwidth="xl">
      <Grid container columnSpacing={4} rowSpacing={4}>
        <Grid item xs={12} md={2}>
          <Stack spacing={2}>
            <Card sx={{ maxWidth: 300, textAlign: "center" }}>
              <CardContent>
                <Typography variant="h6">
                  {Intl.NumberFormat().format(upload.numberOfLinkedPages)}
                </Typography>
                <Typography variant="h5">Pages using file</Typography>
              </CardContent>
            </Card>
            <Card sx={{ maxWidth: 300, textAlign: "center" }}>
              <CardContent>
                <Typography variant="h6">
                  {Intl.NumberFormat().format(upload.linkedPagesViews)}
                </Typography>
                <Typography variant="h5">Total page views</Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={12} md={10}>
          <Stack spacing={2}>
            <Stack
              spacing={2}
              direction="row"
              alignItems="flex-start"
              width="100%"
              justifyContent="flex-start"
            >
              <Link href="/stats">
                <IconButton>
                  <ArrowBack fontSize="large" />
                </IconButton>
              </Link>
              <Typography variant="h5">
                <a
                  href={upload.url}
                  style={{ position: "relative" }}
                  target="_blank"
                >
                  {upload.fileName}
                </a>
              </Typography>
            </Stack>
            <Stack spacing={4}>
              {Object.keys(pages).map((page) => (
                <Stack spacing={2} key={page}>
                  <Accordion defaultExpanded>
                    <AccordionSummary>
                      <Stack>
                        <Typography variant="h6">{page}</Typography>
                        <Typography variant="subtitle1">
                          {Intl.NumberFormat().format(pages[page].length)} pages{" "}
                          <br />
                          {Intl.NumberFormat().format(totalViews[page])} total
                          views
                        </Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Paper
                        sx={{ p: 2, maxHeight: "60vh", overflowY: "auto" }}
                      >
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Page</TableCell>
                              <TableCell>Page views</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pages[page].map((item) => (
                              <TableRow key={item.pageid}>
                                <TableCell width="75%">
                                  <a
                                    target="_blank"
                                    href={`${page}/wiki/${item.title}`}
                                  >
                                    <Tooltip title={item.title}>
                                      <span>{item.title}</span>
                                    </Tooltip>
                                  </a>
                                </TableCell>
                                <TableCell width="25%">
                                  {item.views
                                    ? Intl.NumberFormat().format(item.views)
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FileStatsPage;
