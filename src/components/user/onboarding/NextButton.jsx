import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import { useRoundStep } from '../../../contexts/RoundStepContext';

export default function NextButton() {
  const navigate = useNavigate();
  const {setRound,setStep}=useRoundStep();
  const {isAdmin} = useUser();

  const handleClick = () => {
    setRound(1);
    setStep(1);
    navigate(`/${isAdmin ? 'admin' : 'user'}/slide`);
  };

  return (
    <button className="next-button" onClick={handleClick}>
      다음으로
    </button>
  );
}