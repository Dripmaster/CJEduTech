import { useNavigate } from "react-router-dom";
import { useRoundStep } from '../../../contexts/RoundStepContext';


export default function NextSessionButton() {
  const navigate = useNavigate();
  const { round, setRound, step, setStep } = useRoundStep();
  return (
    <button
      className="next-session-button"
      onClick={() => {
          navigate("/user/end");
      }}
    >
      종료하기
    </button>
  );
}