import { useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { STEPS } from '../../contents/financial-course.js';
import PageHeader from '../common/PageHeader';
import robot from '../../assets/images/common/logoRobot.png';
import '../user/roundIndicator/roundIndicator.css';
export default function RoundIndicator() {
  const { round, step } = useRoundStep();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const paths=['slide','quiz','video','aiDiscussion','discussionResult'];
  return <div className="round-indicator-page"><PageHeader title={`${round}차시`}/>
    <main className="round-indicator">
      <h3>ROUND {round}</h3><img className="logo-robot" src={robot} alt="아이고라 로봇"/>
      <div className="round-step-container">{STEPS.map((label,index)=><div key={label} className={step===index+1?'current-step':'step-indicator'} aria-current={step===index+1?'step':undefined}><h4>STEP {index+1}</h4>{label}</div>)}</div>
      <p className="explanation">강사의 안내에 따라 진행해 주세요.</p>
      <button className="round-start" onClick={() => navigate(`/${isAdmin?'admin':'user'}/${paths[step-1]}`)}>시작하기</button>
    </main>
  </div>;
}
