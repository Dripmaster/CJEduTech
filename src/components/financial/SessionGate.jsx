import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { TOKEN_KEY } from '../../lib/tab-session.js';
export default function SessionGate({children}) {
  const {pathname} = useLocation();
  const {isAdmin,nickname} = useUser();
  if (['/','/user/login','/admin/session','/exit'].includes(pathname)) return children;
  if (isAdmin && ['/user/loadResult','/user/finalResult','/user/end'].includes(pathname)) return children;
  if (pathname.startsWith('/admin/') && !isAdmin) return <EntryRedirect to="/admin/session" />;
  if (pathname.startsWith('/user/') && (isAdmin || !nickname || !sessionStorage.getItem(TOKEN_KEY))) {
    // Full navigation establishes the student role before mounting its screens.
    return <EntryRedirect to="/user/login" />;
  }
  return children;
}
function EntryRedirect({to}) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}
