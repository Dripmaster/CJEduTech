import { http } from '@/lib/http' ;
export const authApi = {
    login: ({nickname, password}) => http.post('/api/auth/login', { nickname, password, tabSession: true }),
    teacherLogin: password => http.post('/api/auth/teacher/login', {password}),
    me: () => http.get('/api/auth/me'),
    logout: () => http.post('/api/auth/logout', {}),
};