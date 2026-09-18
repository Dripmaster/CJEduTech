// src/components/common/PageHeader.jsx

import { useUser } from '@/contexts/UserContext';
import './PageHeader.css';
import LeaveButton from './LeaveButton';

function getAvatarSrc(avatarNumber) {
  if (!avatarNumber) return '';
  // public 폴더 기준 (프로덕션에서도 동작)
  return `/assets/avatar/avatar${avatarNumber}.png`;
}

export default function PageHeader({ title, isShort }) {
  const { nickname, avatarUrl } = useUser();

  return (
    <div className={isShort ? 'page-header-short' : 'page-header'}>
      <div className="title">{title}</div>
      <div className="user-info">
        {avatarUrl && <img src={getAvatarSrc(avatarUrl)} alt="avatar" className="avatar-icon" />}
        {nickname && <span className="nickname">{nickname}</span>}
        <LeaveButton />
      </div>
    </div>
  );
}