import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {authApi} from '../../api/auth';
import {useUser} from '../../contexts/UserContext';
import {useRoundStep} from '../../contexts/RoundStepContext';
import {TOKEN_KEY, clearTabSession} from '../../lib/tab-session';
import {socket} from '../../api/chat';
import logo from '../../assets/images/common/logo.png';
import '../../components/financial/course.css';
export default function AdminSessionPage() {
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const {setIsAdmin,setNickname,setAvatarUrl}=useUser();
  const {resetProgress}=useRoundStep();
  const navigate=useNavigate();
  useEffect(()=>{
    let active=true;
    if(sessionStorage.getItem(TOKEN_KEY)) authApi.me().then(({user})=>{
      if(active && user.role==='admin') navigate('/admin/onboarding',{replace:true});
    }).catch(()=>{});
    return ()=>{active=false;};
  },[navigate]);
  const login=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try {
      const {token,user}=await authApi.teacherLogin(password);
      if(user.role!=='admin'||!token) throw new Error('접속 정보를 확인해 주세요.');
      socket.disconnect();clearTabSession();resetProgress();
      sessionStorage.setItem(TOKEN_KEY,token);sessionStorage.setItem('isAdmin','true');sessionStorage.setItem('nickname','admin');
      setIsAdmin(true);setNickname('admin');setAvatarUrl('');socket.connect();
      navigate('/admin/onboarding',{replace:true});
    } catch(error){setError(error.message || '접속 정보를 확인해 주세요.');}
    finally {setBusy(false);setPassword('');}
  };
  return <main className="finance-course" style={{maxWidth:520,margin:'80px auto',padding:32}}>
    <img src={logo} alt="Aigora" style={{width:180}}/>
    <h1>진행자 인증</h1>
    <form onSubmit={login}>
      <label htmlFor="teacher-password">접속 비밀번호</label>
      <input id="teacher-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',padding:12,margin:'12px 0'}}/>
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy || !password}>{busy?'확인 중…':'접속'}</button>
    </form>
  </main>;
}
