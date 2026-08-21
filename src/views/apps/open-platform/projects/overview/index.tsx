import { Navigate, useParams } from 'react-router';

/** Legacy overview landing → settings (settings demoted from primary path). */
const ProjectOverviewRedirect = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/settings`} replace />;
};

export default ProjectOverviewRedirect;
