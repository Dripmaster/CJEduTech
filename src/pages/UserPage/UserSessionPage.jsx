import robot from '../../assets/images/common/logoRobot.png';
import logo from '../../assets/images/common/logo.png';
import '../../components/admin/session/adminSession.css';
import '../../components/financial/course.css'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from "../../contexts/UserContext";

export default function UserSessionPage(){
    const navigate = useNavigate();
    const [progress, setProgress] = useState(0);
    const {setIsAdmin,setNickname,setAvatarUrl} = useUser();

    useEffect(() => {
        setIsAdmin(false);
        if (sessionStorage.getItem('isAdmin') === 'true') {
            sessionStorage.removeItem('nickname');
            sessionStorage.removeItem('avatarUrl');
            setNickname(''); setAvatarUrl('');
        }
        sessionStorage.removeItem("isAdmin");
        let start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const percent = Math.min((elapsed / 5000) * 100, 100);
            setProgress(percent);
        }, 100);

        const timeout = setTimeout(() => {
            navigate('/user/login');
        }, 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    return (
        <div className="financial-session"><img className="session-robot" src={robot} alt="아이고라 로봇"/><img className="session-logo" src={logo} alt="Aigora"/>
            <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
        </div>
    )
}