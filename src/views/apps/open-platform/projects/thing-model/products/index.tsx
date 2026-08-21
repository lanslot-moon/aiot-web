import { Navigate, useParams } from 'react-router';

/** Legacy thing-model products path → primary /products. */
const ProjectThingModelProductsRedirect = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/products`} replace />;
};

export default ProjectThingModelProductsRedirect;
