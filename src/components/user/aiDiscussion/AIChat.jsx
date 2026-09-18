import { useEffect, useRef, useState } from "react";
import { socket } from "@/api/chat";
import aiIcon from "@/assets/images/discussion/AI_icon.png";
// 효과음 리소스 (경로만 실제 보유 리소스로 교체하면 됩니다)
import sfxComment from "@/assets/sounds/click.wav";
import sfxEncourage from "@/assets/sounds/aiment.wav";

function formatTime(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

// phase: idle → thinking → message
export default function AIChat({ onTopicChange = () => {}, absoluteOnScroll = false }) {
  const [phase, setPhase] = useState("idle");
  const [currentMent, setCurrentMent] = useState(null); // { id, type, text, createdAt }
  const [dots, setDots] = useState(".");
  const [hidden, setHidden] = useState(false);

  const myNick = typeof window !== "undefined" ? sessionStorage.getItem("nickname") : null;
  const thinkTimerRef = useRef(null);
  const dotsTimerRef = useRef(null);
  const pendingRef = useRef(null);

  // preload audio
  const commentAudioRef = useRef(null);
  const encourageAudioRef = useRef(null);
  useEffect(() => {
    commentAudioRef.current = new Audio(sfxComment);
    encourageAudioRef.current = new Audio(sfxEncourage);
    // 낮은 볼륨으로 시작
    if (commentAudioRef.current) commentAudioRef.current.volume = 0.6;
    if (encourageAudioRef.current) encourageAudioRef.current.volume = 0.6;
    return () => {
      [commentAudioRef.current, encourageAudioRef.current].forEach(a => {
        try { a && a.pause(); } catch {}
      });
    };
  }, []);

  useEffect(() => {
      // 효과음 재생 (브라우저 정책상 play가 막히면 조용히 실패)
      const playSafe = (audio) => {
        try { audio && audio.currentTime && (audio.currentTime = 0); } catch {}
        try { audio && audio.play && audio.play().catch(() => {}); } catch {}
      };

    const onMent = (payload) => {
      // payload: { id, roomId, type: "topic_comment"|"encourage", text, targets?: string[], createdAt }
      if (!payload) return;
      if (payload.type === "encourage") {
        const targets = Array.isArray(payload.targets) ? payload.targets : [];
        if (!myNick || !targets.includes(myNick)) return; // 본인 대상 아니면 스킵
      }
      // 토론 주제 관련 멘트면 상위로 전달하여 주제 업데이트
      if (payload?.type === 'current_topic'){
        const newTopic = payload?.topic || payload?.text || '';
        if (newTopic) {
          try { onTopicChange(newTopic); } catch {}
        }
        return;
      }
      if (payload?.type === 'ai_dm'){
        return;
      }

      // 새 멘트가 도착했으므로 숨김 해제
      setHidden(false);

      // 먼저 thinking 연출로 전환 (이전 멘트는 유지)
      pendingRef.current = payload;
      setPhase("thinking");
      // setCurrentMent(null); // 유지

      // dots 애니메이션 시작 (".", "..", "..." 순환)
      clearInterval(dotsTimerRef.current);
      setDots(".");
      dotsTimerRef.current = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
      }, 300);

      // 잠깐 생각중(예: 900ms) 후 멘트 표시 + 사운드
      clearTimeout(thinkTimerRef.current);
      thinkTimerRef.current = setTimeout(() => {
        const next = pendingRef.current;
        setCurrentMent(next);
        setPhase("message");
        



        // 효과음 재생 (브라우저 정책상 play가 막히면 조용히 실패)
        const playSafe = (audio) => {
          try { audio && audio.currentTime && (audio.currentTime = 0); } catch {}
          try { audio && audio.play && audio.play().catch(() => {}); } catch {}
        };
        if (next?.type === "encourage") playSafe(encourageAudioRef.current);
        else playSafe(commentAudioRef.current);

        // 멘트는 다음 멘트가 올 때까지 유지
        clearInterval(dotsTimerRef.current);
      }, 900);
    };

    socket.on("ai:ment", onMent);
    return () => {
      socket.off("ai:ment", onMent);
      clearTimeout(thinkTimerRef.current);
      clearInterval(dotsTimerRef.current);
    };
  }, [myNick, onTopicChange]);

  // 항상 상주: idle일 때도 배지와 말풍선 프레임은 보여줌
  return (
    <div
      className={`ai-chat ai-chat--${phase} ${absoluteOnScroll ? 'ai-chat--abs' : ''}`}
      onClick={() => setHidden(prev => !prev)}
      style={{
        display: hidden ? 'none' : 'flex',
        position: absoluteOnScroll ? 'absolute' : undefined,
        left: absoluteOnScroll ? '3%' : undefined,
      }}
    >
      <img className="badge-img" src={aiIcon} alt="aiIcon"/>

      {/* 메시지는 유지 표시 (thinking 중에도) */}
      {currentMent && (
        <div className="ai-chat-text">
          {currentMent.text}
          {phase === 'thinking' && (
            <div className="ai-thinking-line" aria-live="polite">생각중{dots}</div>
          )}
        </div>
      )}

      {/* 아직 받은 메시지가 없을 때만 idle 문구 */}
      {!currentMent && phase === 'idle' && (
        <div className="ai-chat-text ai-chat-text--idle">환영합니다! 원활한 토론 진행을 위해 아이고라AI가 함께 참여할게요!</div>
      )}

      {/* 초기/특수한 경우: 메시지는 없지만 thinking 상태일 때 */}
      {!currentMent && phase === 'thinking' && (
        <div className="ai-chat-text" aria-live="polite">
          <span className="ai-thinking">생각중{dots}</span>
        </div>
      )}
    </div>
  );
}