import { useState, useEffect } from "react";
import AIChat from "./AIChat";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import ChatSubmitButton from "./ChatSubmitButton";
import { useRoundStep } from '@/contexts/RoundStepContext';
import PageHeader from "../../../components/common/PageHeader";


export default function ChatContainer({ nickname, topic }) {
    const [localNickname, setLocalNickname] = useState(nickname);
    const [localTopic, setLocalTopic] = useState(topic);

    const { round, setRound, step, setStep,videoId,setVideoId } = useRoundStep();
    useEffect(() => {
      if (!nickname) {
        const storedNickname = sessionStorage.getItem("nickname");
        if (storedNickname) setLocalNickname(storedNickname);
      }
      if (!topic) {
        const storedTopic = sessionStorage.getItem("topic");
        if (storedTopic) setLocalTopic(storedTopic);
      }
    }, [nickname, topic]);

    const handleTopicChange = (nextTopic) => {
      if (!nextTopic) return;
      setLocalTopic(nextTopic);
      try { sessionStorage.setItem('topic', nextTopic); } catch {}
    };

    return (
        <div className="chat-container">
          <PageHeader isShort={true} title={`${localTopic || '토론 주제'}`}/>
            <ChatHistory onTopicChange={handleTopicChange}/>
            <div className="chat-input-area">
                <ChatInput/>
            </div>
        </div>
    )
}