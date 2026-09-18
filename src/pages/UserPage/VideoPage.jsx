import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { getActivity } from '../../contents/financial-course.js';
import PageHeader from '../../components/common/PageHeader';
import '../../components/user/video/video.css';
import '../../components/financial/course.css';
import '../../components/admin/indicatorNextButton.css';
import aiIcon from '../../assets/images/discussion/AI_icon.png';

function StudentVideoGuide({ title, onNext }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  return <div className="financial-video-indicator">
    <PageHeader title={title}/>
    <div className="financial-video-message">
      <img src={aiIcon} alt="아이고라 로봇"/>
      <p>강사의 화면으로 영상을 시청한 뒤, 본인의 화면으로 토론에 참여해 주세요.<br/>영상 속 상황에 이입하여, 본인이라면 어떻게 판단하고 행동할지 생각해 보세요.<br/>금융이해 · 위험인식 · 계획성 · 실천의지를 중심으로 시청해 주세요.</p>
    </div>
    <div className="financial-video-footer">영상 시청 종료 후 다음으로 버튼을 눌러주세요.</div>
    <button className="indicator-next-button" disabled={!ready} onClick={onNext} style={{ opacity: ready ? 1 : 0.5 }}>다음으로</button>
  </div>;
}
export default function VideoPage() {
  const { round, videoId, setStep } = useRoundStep();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const lesson = videoId === null ? null : getActivity(videoId);
  const [error, setError] = useState(false);
  const configured = import.meta.env[`VITE_FINANCIAL_VIDEO_${videoId+1}`] || lesson?.videoSrc;
  const next = () => {setStep(4);navigate(`/${isAdmin?'admin':'user'}/aiDiscussion`);};
  if (!lesson) return <Navigate to={`/${isAdmin?'admin':'user'}/slide`} replace/>;
  if (!isAdmin) return <StudentVideoGuide key={videoId} title={`${round}차시 · ${lesson.videoTitle} · 영상`} onNext={next}/>;
  return <div className="video-page">
    <PageHeader title={`${round}차시 · ${lesson.videoTitle} · 영상`}/>
    <main className="video-main">
      <div className="video-player">{configured ? <video className="video-element" src={configured} controls playsInline preload="metadata" onError={() => setError(true)}/> : <section className="finance-empty"><h2>영상 파일 준비 중</h2><p>원본 {lesson.sourceScenarioId}번 영상이 아직 전달되지 않았습니다.</p></section>}</div>
      <footer className="video-footer">
        <p className="video-guide">{error ? '영상을 재생하지 못했습니다. 영상 주소와 파일 형식을 확인해 주세요.' : '강사의 안내에 따라 시청해 주세요.'}</p>
        <button className="finish-button" onClick={next}>{configured ? '토론으로 이동' : '영상 없이 토론 화면 확인'}</button>
      </footer>
    </main>
  </div>;
}
