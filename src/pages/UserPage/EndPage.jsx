import { useNavigate } from 'react-router-dom';
import '../../components/user/end/end.css';
export default function EndPage(){
 const navigate=useNavigate();
 return <main className="end-page" aria-label="축하합니다. 모든 교육을 마치셨습니다."><button className="end-result-button" onClick={()=>navigate('/user/finalResult')}>종합 결과 다시 보기</button></main>;
}
