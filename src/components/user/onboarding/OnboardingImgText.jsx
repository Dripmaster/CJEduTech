import OnboardingText from './OnboardingText';
import logoRobot from '@/assets/images/common/logoRobot.png';
export default function OnboardingImgText(){
  return <div className="onboarding-img-text">
    <img className="logo-robot" src={logoRobot} alt="아이고라 로봇"/>
    <OnboardingText heading="오늘 교육은?" p={"내 삶을 위한 금융 지식을 함께 배웁니다.\n총 4차시 동안 이론 · 영상 · 토론을 진행하며,\n1·2차시는 이론 다음에 퀴즈로 점검합니다.\n차시별 대시보드로 나의 생각을 돌아봅니다.\n마지막에는 종합 대시보드를 확인합니다."}/>
  </div>;
}
