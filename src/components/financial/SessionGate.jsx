import {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useUser} from '../../contexts/UserContext';
import {TOKEN_KEY} from '../../lib/tab-session';
import {authApi} from '../../api/auth';
export default function SessionGate({children}) {
  const {pathname}=useLocation();
  const {isAdmin,nickname}=useUser();
  if (['/','/user/login','/admin/session','/exit'].includes(pathname)) return children;
  const teacherPath=pathname.startsWith('/admin/') || (isAdmin && ['/user/loadResult','/user/finalResult','/user/end'].includes(pathname));
  if (teacherPath) return <TeacherGate>{children}</TeacherGate>;
  if (pathname.startsWith('/user/') && (isAdmin || !nickname || !sessionStorage.getItem(TOKEN_KEY))) return <EntryRedirect to="/user/login"/>;
  return children;
}
function TeacherGate({children}) {
  const [status,setStatus]=useState('checking');
  const {setIsAdmin,setNickname,setAvatarUrl}=useUser();
  useEffect(()=>{
    let active=true;
    authApi.me().then(({user})=>{
      if(!active)return;
      if(user.role!=='admin'){setStatus('denied');return;}
      setIsAdmin(true);setNickname('admin');setAvatarUrl('');setStatus('allowed');
    }).catch(()=>{if(active)setStatus('denied');});
    return ()=>{active=false;};
  },[setIsAdmin,setNickname,setAvatarUrl]);
  if(status==='checking')return <p role="status">접속 확인 중입니다.</p>;
  if(status==='denied')return <EntryRedirect to="/user/login"/>;
  return children;
}
function EntryRedirect({to}) {
  useEffect(()=>{window.location.replace(to);},[to]);
  return null;
}
