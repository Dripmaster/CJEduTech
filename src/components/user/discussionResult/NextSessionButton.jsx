import { useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../../contexts/RoundStepContext';
import { useUser } from '../../../contexts/UserContext';
import { nextLesson } from '../../../contents/financial-course.js';
export default function NextSessionButton() {
  const navigate = useNavigate();
  const { round, setRound, setStep } = useRoundStep();
  const { isAdmin } = useUser();
  const next = nextLesson(round);
  return <button className="next-session-button" onClick={() => {
    if (next.final) { navigate('/user/loadResult'); return; }
    setRound(next.round); setStep(1);
    navigate(`/${isAdmin?'admin':'user'}/slide`);
  }}>{next.final ? '종합 대시보드 보기' : `${next.round}차시 이론으로`}</button>;
}
