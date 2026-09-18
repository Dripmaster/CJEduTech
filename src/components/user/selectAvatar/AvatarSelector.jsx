// src/components/user/selectAvatar/AvatarSelector.jsx
import { useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import ActionButtons from './ActionButtons.jsx';
import AvatarButtons from './AvatarButtons.jsx';
import BackButton from "./BackButton";
import StartButton from "./StartButton";

import './selectAvatar.css';
import LeaveButton from '../../common/LeaveButton';
import { http } from '@/lib/http';

// API 유틸 (http.js 기반)


export default function AvatarSelector() {
  const [selected, setSelected] = useState(null); // '1'..'12' 문자열 또는 null
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const { setAvatarUrl } = useUser();

  // 현재 사용자 아바타 불러오기
  useEffect(() => {
    (async () => {
      try {
        const data = await http.get('/api/user/me');
        if (data?.user?.avatar) setSelected(String(data.user.avatar));
      } catch (_) {}
    })();
  }, []);

  // 아바타 저장
  const saveAvatar = async () => {
    if (!selected) {
      setMsg('아바타를 선택해주세요.');
      return;
    }
    setSaving(true);
    setMsg('');
    console.log('avatar:',String(selected));
    sessionStorage.setItem('avatarUrl', String(selected));
    try {
      await http.post('/api/user/avatar', { avatar: String(selected) });
      setAvatarUrl(String(selected));

      setMsg('아바타가 저장되었습니다!');
    } catch (e) {
      setMsg('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="avatar-selector">
      <h3>프로필 선택</h3>
      <AvatarButtons selected={selected} onSelect={setSelected} />

      {msg && <p className="avatar-msg" role="alert">{msg}</p>}

              <div className="action-buttons">
                  <BackButton/>
                  <LeaveButton/>
                  <StartButton onSelect={saveAvatar} />
              </div>
    </div>
  );
}