import {Navigate, useLocation} from 'react-router-dom';

// Keep old bookmarks working without an artificial wait before the real request.
export default function LoadResultPage() {
  const {search} = useLocation();
  return <Navigate to={`/user/finalResult${search}`} replace />;
}
