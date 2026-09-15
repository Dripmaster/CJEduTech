import { useRoundStep } from '../../contexts/RoundStepContext';
import { STEPS, getLesson } from '../../contents/financial-course.js';
import PageHeader from '../common/PageHeader';
import './course.css';
export default function CourseShell({ stage, children }) {
  const { round } = useRoundStep();
  return <div className={`finance-course finance-stage-${stage}`}>
    <PageHeader title={`${round}차시 · ${getLesson(round).title} · ${STEPS[stage-1]}`} />
    <main className="finance-content">{children}</main>
  </div>;
}
