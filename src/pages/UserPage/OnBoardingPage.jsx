import PageHeader from '../../components/common/PageHeader';
import OnboardingMain from '../../components/user/onboarding/OnboardingMain';
import '../../components/user/onboarding/onboarding.css';
export default function OnBoardingPage() {
  return <div className="onboarding-page"><PageHeader title="Onboarding"/><OnboardingMain/></div>;
}
