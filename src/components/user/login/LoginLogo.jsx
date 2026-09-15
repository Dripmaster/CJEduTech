import logoRobot from '../../../assets/images/common/logoRobot.png';
import logo from '../../../assets/images/common/logo.png';
import './login.css';
export default function LoginLogo() {
 return <div className="login-logo" style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
   <img src={logoRobot} alt="아이고라 로봇" style={{height:'426px',aspectRatio:'1 / 1'}}/>
   <img src={logo} alt="Aigora" style={{width:'392px',height:'134px',objectFit:'contain'}}/>
 </div>;
}
