import { clearTabSession } from '../../lib/tab-session.js';
import { socket } from '../../api/chat.js';
import './LeaveButton.css';
export default function LeaveButton() {
  const leave = () => {
    socket.disconnect();
    clearTabSession();
    // Reload discards React state and pending listeners in this tab only.
    window.location.replace('/exit');
  };
  return <button type="button" className="leave-button" onClick={leave}>나가기</button>;
}
