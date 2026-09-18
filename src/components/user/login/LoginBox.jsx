// src/components/user/login/LoginBox.jsx
import './login.css';
import {socket} from '@/api/chat';
import { TOKEN_KEY, clearTabSession } from '@/lib/tab-session.js';
import { useRoundStep } from '@/contexts/RoundStepContext';
import LoginTitle from './LoginTitle';
import LoginInput from './LoginInput';
import SubmitButton from './SubmitButton';
import { useState } from 'react';
import { authApi } from '@/api/auth';
import nickIcon from '@/assets/images/login/nickIcon.svg';
import psIcon from '@/assets/images/login/psIcon.svg';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';

export default function LoginBox() {
  const {resetProgress} = useRoundStep();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const { setNickname: setUserNickname, setAvatarUrl, setIsAdmin } = useUser();

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const { user, token } = await authApi.login({ nickname, password });
      if (!token) throw new Error('로그인 연결을 갱신 중입니다. 잠시 후 다시 시도해주세요.');
      socket.disconnect();
      clearTabSession();
      resetProgress();
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem('isAdmin', 'false');
      setIsAdmin(false);
      socket.connect();
      // 컨텍스트 & 로컬스토리지 업데이트
      setUserNickname(user.nickname);
      setAvatarUrl(user.avatar ?? '');
      sessionStorage.setItem('nickname', user.nickname);
      if (user.avatar) sessionStorage.setItem('avatarUrl', user.avatar); else sessionStorage.removeItem('avatarUrl');
      setMsg(`${user.nickname}님 환영합니다!`);
      showToast(`${user.nickname}님 환영합니다!`, 'success');
      navigate('/user/selectAvatar');
      
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      const serverMsg = err?.payload?.message || err?.message;

      if (status === 401) showToast('닉네임 또는 비밀번호가 올바르지 않습니다.(이미 사용 중인 닉네임입니다.)', 'error');
      else if (status === 409) showToast('이미 사용 중인 닉네임입니다.', 'error');
      else if (status === 400) showToast(serverMsg || '입력값을 확인해주세요.', 'error');
      else showToast(serverMsg || '로그인 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="login-box" onSubmit={onSubmit}>
      <LoginTitle />
      <LoginInput
        label="닉네임을 입력하세요"
        icon={nickIcon}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <LoginInput
        label="비밀번호를 입력하세요"
        type="password"
        icon={psIcon}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <SubmitButton
        disabled={loading || !nickname.trim() || !password.trim()}
        text={loading ? '처리중...' : '시작하기'}
      />
      {msg && <p className="login-msg">{msg}</p>}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}
    </form>
  );
}