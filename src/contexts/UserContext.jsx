import { createContext, useContext, useState } from 'react';
const UserContext = createContext();
export function UserProvider({ children }) {
  const [nickname, setNickname] = useState(() => sessionStorage.getItem('nickname') || '');
  const [avatarUrl, setAvatarUrl] = useState(() => sessionStorage.getItem('avatarUrl') || '');
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');
  return <UserContext.Provider value={{nickname,setNickname,avatarUrl,setAvatarUrl,isAdmin,setIsAdmin}}>{children}</UserContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components -- Existing context API.
export function useUser() { return useContext(UserContext); }
