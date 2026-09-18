import logo from '../../assets/images/common/logo.png';
import '../../components/financial/course.css';
export default function ExitPage() {
  return <main className="finance-course" style={{maxWidth:640,margin:'80px auto',padding:32,textAlign:'center'}}>
    <img src={logo} alt="Aigora" style={{width:180}} />
    <h1>접속을 종료했습니다.</h1>
    <p>제출한 답안과 수업 기록은 삭제되지 않습니다.</p>
    <div className="finance-controls" style={{justifyContent:'center',marginTop:24}}>
      <a href="/">다시 접속</a>
    </div>
  </main>;
}
