import aiIcon from "@/assets/images/discussion/AI_icon.png";
// Discussion ends when the teacher finishes it; this circle is a mascot, not a clock.
export default function ChatTimer(){
 return <div className="overview-top"><div className="timer-wrap"><div className="timer-face"><img className="discussion-mascot" src={aiIcon} alt="아이고라" /></div></div></div>;
}
