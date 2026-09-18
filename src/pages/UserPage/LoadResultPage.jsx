import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import botImg from '@/assets/images/AI_large_icon.png';
import '../../components/user/finalResult/loadResultPage.css';
/**
 * 3-STEP LOADING PAGE
 * - 3단계 순차 표시, 각 단계 최소 3초
 * - 반원형 프로그래스(아크) 단계별 0→100% 애니메이션
 * - 마지막 단계 종료 후 FinalResultPage로 이동
 * - roomId / nickname 은 쿼리·세션에서 읽고 세션에 저장
 */
export default function LoadResultPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const roomId =
    params.get('roomId') || sessionStorage.getItem('lastRoomId') || '';
  const nickname =
    params.get('nickname') ||
    sessionStorage.getItem('myNickname') ||
    sessionStorage.getItem('nickname') ||
    '';

  // 단계 텍스트
  const steps = useMemo(
    () => [
      {
        title: '교육 진행률 확인중…',
        sub: '학습 데이터를 분석중입니다.\n잠시후 전체적인 피드백을 전달드릴게요.',
      },
      {
        title: 'AI 피드백 작성중…',
        sub: '학습 데이터를 분석중입니다.\n잠시후 전체적인 피드백을 전달드릴게요.',
      },
      {
        title: '금융교육 발언 역량 확인중…',
        sub: '학습 데이터를 분석중입니다.\n잠시후 전체적인 피드백을 전달드릴게요.',
      },
    ],
    []
  );

  // 상태
  const [idx, setIdx] = useState(0); // 0..2
  const [progress, setProgress] = useState(0); // 0..100 (각 단계)
  const animRef = useRef(null);

  // 단계별 반원형 프로그래스 애니메이션 (최소 3초)
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    setProgress(0);
    const start = performance.now();
    const DUR = 3000;

    function tick(now) {
      const t = Math.min(1, (now - start) / DUR);
      setProgress(Math.round(t * 100));
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [idx]);

  // 3초마다 다음 단계로, 마지막은 종료 후 네비게이트
  useEffect(() => {
    const DUR = 3000;
    if (idx < 2) {
      const t = setTimeout(() => setIdx((i) => Math.min(i + 1, 2)), DUR);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        if (roomId) sessionStorage.setItem('lastRoomId', roomId);
        if (nickname) sessionStorage.setItem('myNickname', nickname);
        navigate('/user/finalResult');
      }, DUR);
      return () => clearTimeout(t);
    }
  }, [idx, navigate, roomId, nickname]);

  // 반원형 프로그래스 도형 계산
  const radius = 260; // px
  const stroke = 18; // 두께
  const cx = radius + stroke;
  const cy = radius + stroke;
  const semicircLen = Math.PI * radius; // 반원 둘레길이
  const dash = (progress / 100) * semicircLen;

  return (
    <div className="lrp-page">
      <header className="lrp-topbar">
        <h1 className="lrp-title">전체 결과 대시보드</h1>
        <div className="lrp-user">{nickname || '사용자'}</div>
      </header>

      <main className="lrp-main">
        <div className="lrp-arc">
          <svg
            width={(radius + stroke) * 2}
            height={radius + stroke + stroke * 2}
            viewBox={`0 0 ${(radius + stroke) * 2} ${
              radius + stroke + stroke * 2
            }`}
          >
            {/* 트랙 */}
            <path
              d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0 1 ${
                cx + radius
              },${cy}`}
              fill="none"
              stroke="#E5E5E5"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            {/* 진행 */}
            <path
              d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0 1 ${
                cx + radius
              },${cy}`}
              fill="none"
              stroke="#FF6E37"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${semicircLen - dash}`}
            />
          </svg>
          <img className="lrp-bot" src={botImg} alt="loading mascot" />
        </div>

        <div className="lrp-text">
          <h2 className="lrp-step-title">{steps[idx].title}</h2>
          <p className="lrp-step-sub">{steps[idx].sub}</p>
        </div>
      </main>
    </div>
  );
}
