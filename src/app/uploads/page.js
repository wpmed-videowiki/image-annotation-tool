import { Container } from "@mui/material";

import { listMyJobs } from "../actions/jobs";
import { getCurrentUserSummary } from "../lib/session";
import LoginScreen from "../components/LoginScreen";
import UploadsList from "../components/uploads/UploadsList";

export const metadata = { title: "My uploads - Image Annotation Tool" };

const UploadsPage = async (props) => {
  const user = await getCurrentUserSummary();
  if (!user) {
    return (
      <Container maxWidth="xl">
        <LoginScreen />
      </Container>
    );
  }

  const searchParams = (await props.searchParams) || {};
  const filters = {
    archived: searchParams.archived === "1",
    status: typeof searchParams.status === "string" ? searchParams.status : "",
    page: Math.max(1, parseInt(searchParams.page, 10) || 1),
  };
  const initial = await listMyJobs(filters);

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <UploadsList initial={initial} initialFilters={filters} />
    </Container>
  );
};

export default UploadsPage;
