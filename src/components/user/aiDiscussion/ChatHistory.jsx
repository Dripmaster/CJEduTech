import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { socket } from "@/api/chat";
import Chat from "./Chat";
import { useRoundStep } from '@/contexts/RoundStepContext';
import AIChat from "./AIChat";
import aiIcon from "@/assets/images/discussion/AI_icon.png";
import {useUser} from  '@/contexts/UserContext.jsx'
function generateRandomNickname() {
  const adjectives = ["빠른", "멋진", "똑똑한", "용감한", "행복한"];
  const animals = ["호랑이", "토끼", "독수리", "사자", "여우"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective}${animal}${Math.floor(Math.random() * 1000)}`;
}

export default function ChatHistory({ onTopicChange = () => {} }) {
  const [myNick] = useState(() => {
    let storedNick = sessionStorage.getItem("nickname");
    if (!storedNick) {
      storedNick = generateRandomNickname();
      sessionStorage.setItem("nickname", storedNick);
    }
    return storedNick;
  });

  const [messages, setMessages] = useState([]);
  const [autoScroll, setAutoScroll] = useState(false);
  const [hasScroll, setHasScroll] = useState(false);
  const updateHasScroll = () => {
    const el = historyRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight > el.clientHeight + 1; // allow tiny rounding error
    setHasScroll(scrollable);
  };
  const roomId = "general";

  const bottomRef = useRef(null);
  const historyRef = useRef(null);
  const prevScrollHeightRef = useRef(0);

  const { round:lessonRound, videoId } = useRoundStep();
const round=videoId+1;
const{isAdmin} = useUser();
  const isNearBottom = () => {
    if (!historyRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = historyRef.current;
    return scrollHeight - (scrollTop + clientHeight) < 50; // within 50px
  };
 
  const forceScrollToBottom = () => {
    const el = historyRef.current;
    if (!el) return;
    // immediate jump
    el.scrollTop = el.scrollHeight;
    // next paint
    requestAnimationFrame(() => {
      const el2 = historyRef.current; if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
      // microtask/timeout to catch late layout (fonts/images)
      setTimeout(() => {
        const el3 = historyRef.current; if (!el3) return;
        el3.scrollTop = el3.scrollHeight;
      }, 0);
    });
  };

  useLayoutEffect(() => {
    const el = historyRef.current;
    if (!el) return;

    if (autoScroll) {
      forceScrollToBottom();
      setAutoScroll(false);
    }
    // store new height for potential future calculations
    prevScrollHeightRef.current = el.scrollHeight;
    updateHasScroll();
  }, [messages, autoScroll]);

  useEffect(() => {
    console.log("채팅방 입장 : ",roomId," 라운드 : ",round, "videoId : ",videoId,"isAdmin : ",isAdmin);
    socket.emit("room:join", { roomId,round,videoId,lessonRound,isAdmin});

    socket.on("room:recent", (payload) => {
      setMessages(payload.messages || []);
      // 초기 렌더 후 기준 높이 기록
      requestAnimationFrame(() => {
        if (historyRef.current) {
          prevScrollHeightRef.current = historyRef.current.scrollHeight;
        }
      });
      requestAnimationFrame(() => updateHasScroll());
    });

    socket.on("message:new", (newMessage) => {
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      // 새 메시지는 무조건 하단으로 이동
      setAutoScroll(true);
      requestAnimationFrame(() => updateHasScroll());
    });

    socket.on("reaction:update", ({ messageId, reactedUsers, reactionsCount }) => {
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, reactedUsers, reactionsCount } : m)
      );
    });

    socket.on("message:ai", ({ messageId, aiLabels, aiScores, aiLabel, aiScore }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? {
        ...m,
        aiLabels: Array.isArray(aiLabels) ? aiLabels : (aiLabel ? [aiLabel] : m.aiLabels),
        aiScores: aiScores || m.aiScores,
        aiLabel: aiLabel ?? m.aiLabel,
        aiScore: (typeof aiScore === 'number' ? aiScore : m.aiScore)
      } : m));
      // 라벨 업데이트 시에도 무조건 하단으로 이동
      setAutoScroll(true);
    });

    // AI DM listener (private AI DM messages)
    const onAiMent = (payload) => {
      // Only handle private AI DM messages here; others are ignored
      if (!payload || payload.type !== 'ai_dm') return;
      // Push as a regular chat message from AI with AI avatar
      setMessages((prev) => [
        ...prev,
        {
          id: payload.id || `ai_dm_${Date.now()}`,
          roomId,
          nickname: '아이고라AI',
          text: payload.text || '',
          createdAt: payload.createdAt || new Date().toISOString(),
          avatar: 'ai',
          avatarUrl:'ai',
        },
      ]);
      setAutoScroll(true);
    };
    socket.on('ai:ment', onAiMent);

    return () => {
      socket.off("room:recent");
      socket.off("message:new");
      socket  .off("reaction:update");
      socket.off("message:ai");
      socket.off('ai:ment', onAiMent);
    };
  }, []);

  useEffect(() => {
    const onResize = () => updateHasScroll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="chat-history" ref={historyRef}>
      <AIChat onTopicChange={onTopicChange} absoluteOnScroll={hasScroll} />
      {messages.map((msg) => (
        <div
          key={msg.id}
          onClick={() => {
            if (msg.nickname !== myNick) {
              socket.emit("reaction:toggle", { messageId: msg.id, nickname: myNick });
            }
          }}
          style={{ cursor: msg.nickname !== myNick ? 'pointer' : 'default' }}
        >
          <Chat
            isMine={msg.nickname === myNick}
            nickname={msg.nickname}
            text={msg.text}
            createdAt={msg.createdAt}
            reactionsCount={msg.reactionsCount || (msg.reactedUsers ? msg.reactedUsers.length : 0)}
            didReact={Array.isArray(msg.reactedUsers) ? msg.reactedUsers.includes(myNick) : false}
            aiLabels={msg.aiLabels}
            aiScores={msg.aiScores}
            aiLabel={msg.aiLabel}
            aiScore={msg.aiScore}
            avatarUrl={msg.avatar}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}