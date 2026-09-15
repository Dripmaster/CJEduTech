// src/contexts/UserContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');

  useEffect(() => {
    const storedNickname = localStorage.getItem('nickname');
    const storedAvatarUrl = localStorage.getItem('avatarUrl');
    const storedIsAdmin = localStorage.getItem('isAdmin');
    if (storedNickname) setNickname(storedNickname);
    if (storedAvatarUrl) setAvatarUrl(storedAvatarUrl);
    if (storedIsAdmin === 'true') setIsAdmin(true);
    if (isAdmin) setNickname('admin');
  }, []);

  return (
    <UserContext.Provider value={{ nickname, setNickname, avatarUrl, setAvatarUrl, isAdmin, setIsAdmin }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}