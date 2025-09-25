import { useEffect, useMemo, useState } from "react";
import SavePDFButton from "./SavePDFButton";
import NextSessionButton from "./NextSessionButton";
import "./discussionResult.css";
import { http } from '@/lib/http' ;

import heroSheep from "@/assets/images/discussion/1_sheep.png";
import donutPlaceholder from "@/assets/images/discussion/donut_placeholder.png";
import myAvatar from "@/assets/images/avatar/avatar2.png";
import badgeJustice from "@/assets/images/discussion/badge_1.png";
import badgePassion from "@/assets/images/discussion/badge_2.png";
import badgeCreativity from "@/assets/images/discussion/badge_3.png";
import badgeRespect from "@/assets/images/discussion/badge_4.png";
import user1Avatar from "@/assets/images/avatar/avatar1.png";
import aiIcon from "@/assets/images/discussion/AI_icon.png";

function buildMockRoomResult(nickname = '나'){
  const createdAt = new Date().toISOString();
  const perUser = {
    [nickname]: {
      totalMessages: 18,
      totalReactions: 27,
      labels: { '정직': 8, '열정': 5, '창의': 3, '존중': 2 },
      topReacted: { text: '데이터 기반으로 의사결정하면 설득력이 높아집니다.', reactionsCount: 12 }
    },
    '동료A': { totalMessages: 14, totalReactions: 21, labels: { '정직': 4, '열정': 6, '창의': 2, '존중': 2 }, topReacted: { text: '고객 관점을 더 녹이면 좋겠어요.', reactionsCount: 9 } },
    '동료B': { totalMessages: 9,  totalReactions: 13, labels: { '정직': 2, '열정': 2, '창의': 4, '존중': 1 }, topReacted: { text: '실험을 작게 자주 해보죠.', reactionsCount: 6 } },
    '동료C': { totalMessages: 7,  totalReactions: 8,  labels: { '정직': 1, '열정': 3, '창의': 1, '존중': 2 }, topReacted: { text: '일정을 먼저 확정합시다.', reactionsCount: 4 } },
  };
  const ranking = [
    { nickname, rank: 1, score: 96, totalMessages: perUser[nickname].totalMessages, totalReactions: perUser[nickname].totalReactions },
    { nickname: '동료A', rank: 2, score: 88, totalMessages: perUser['동료A'].totalMessages, totalReactions: perUser['동료A'].totalReactions },
    { nickname: '동료B', rank: 3, score: 80, totalMessages: perUser['동료B'].totalMessages, totalReactions: perUser['동료B'].totalReactions },
    { nickname: '동료C', rank: 4, score: 72, totalMessages: perUser['동료C'].totalMessages, totalReactions: perUser['동료C'].totalReactions },
  ];
  return { perUser, ranking, createdAt };
}

function buildMockMyResult(nickname = '나', room){
  const u = room.perUser[nickname];
  const me = room.ranking.find(r => r.nickname === nickname) || { rank: 1, score: 96 };
  return {
    roomId: 'mock-room',
    rank: me.rank,
    score: me.score,
    totalMessages: u.totalMessages,
    totalReactions: u.totalReactions,
    labels: u.labels,
    topReacted: u.topReacted,
    createdAt: room.createdAt,
  };
}

export default function DiscussionResultMain() {
  const [roomId, setRoomId] = useState("");
  const [myNickname, setMyNickname] = useState("");
  const [roomResult, setRoomResult] = useState(null); // { perUser, ranking, createdAt }
  const [myResult, setMyResult] = useState(null);     // { rank, score, totalMessages, totalReactions, labels, topReacted }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overallSummary, setOverallSummary] = useState("");

  const badgeMap = {
    justice: badgeJustice,
    passion: badgePassion,
    creativity: badgeCreativity,
    respect: badgeRespect
  };

  useEffect(() => {
    const rid = sessionStorage.getItem("lastRoomId") || "";
    const nick = sessionStorage.getItem("myNickname") || localStorage.getItem("nickname") || "";
    setRoomId(rid);
    setMyNickname(nick);

    async function load() {
      try {
        setLoading(true);
        setError("");
        if (!rid) throw new Error("roomId_missing");
        // fetch room & my results in parallel (http.get returns parsed JSON or throws)
        const roomReq = http.get(`/api/chat/result/${encodeURIComponent(rid)}`);
        const myReq = nick ? http.get(`/api/chat/my-result?nickname=${encodeURIComponent(nick)}`) : Promise.resolve(null);
        const [roomOutcome, myOutcome] = await Promise.allSettled([roomReq, myReq]);

        if (roomOutcome.status !== 'fulfilled') throw roomOutcome.reason || new Error('room_result_error');
        const roomData = roomOutcome.value;
        setRoomResult(roomData);

                // --- Overall summary (once per room) ---
        try {
          // 1) 조회
          const getRes = await http.get(`/api/review/${encodeURIComponent(rid)}/overall-summary`);
          setOverallSummary(getRes?.summaryText || "");
        } catch (e1) {
          // 2) 없으면 생성(1회)
          try {
            const postRes = await http.post(`/api/review/${encodeURIComponent(rid)}/overall-summary`, {});
            setOverallSummary(postRes?.summaryText || "");
          } catch (e2) {
            setOverallSummary("");
          }
        }

        if (myOutcome.status === 'fulfilled' && myOutcome.value) {
          setMyResult(myOutcome.value);
        } else {
          // fallback: derive my result from room perUser
          if (nick && roomData && roomData.perUser && roomData.perUser[nick]) {
            const u = roomData.perUser[nick];
            setMyResult({
              roomId: rid,
              rank: (roomData.ranking || []).find(r => r.nickname === nick)?.rank ?? undefined,
              score: (roomData.ranking || []).find(r => r.nickname === nick)?.score ?? undefined,
              totalMessages: u.totalMessages,
              totalReactions: u.totalReactions,
              labels: u.labels,
              topReacted: u.topReacted,
              createdAt: roomData.createdAt,
            });
          }
        }
      } catch (e) {
        // Fallback to mock data when API fails
        const nickSafe = nick || '나';
        const mockRoom = buildMockRoomResult(nickSafe);
        const mockMe = buildMockMyResult(nickSafe, mockRoom);
        setRoomResult(mockRoom);
        setMyResult(mockMe);
        setOverallSummary('토론 전반에 걸쳐 활발한 참여가 이루어졌습니다. 특히 정직과 열정 관련 메시지가 두드러졌으며, 팀 내 의사결정에 긍정적 영향을 주었습니다.');
        setError('');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Aggregate totals for hero copy (전체)
  const heroTotals = useMemo(() => {
    if (!roomResult) return { users: 0, messages: 0, reactions: 0, labels: 0 };
    const perUser = roomResult.perUser || {};
    let users = 0, messages = 0, reactions = 0, labels = 0;
    for (const nick of Object.keys(perUser)) {
      users += 1;
      const u = perUser[nick];
      messages += Number(u.totalMessages || 0);
      reactions += Number(u.totalReactions || 0);
      labels += Object.values(u.labels || {}).reduce((a,b)=>a+(b||0),0);
    }
    return { users, messages, reactions, labels };
  }, [roomResult]);

  const myLabelEntries = useMemo(() => {
    const L = myResult?.labels || { "정직":0, "열정":0, "창의":0, "존중":0 };
    const sum = Object.values(L).reduce((a,b)=>a+(b||0),0) || 1;
    const entries = ["정직","열정","창의","존중"].map(k => ({ key:k, val: Number(L[k]||0), pct: Math.round((Number(L[k]||0)/sum)*100) }));
    return { entries, sum };
  }, [myResult]);

  // Ranking list (top 10)
  const ranking = roomResult?.ranking || [];
  const topN = ranking.slice(0, 10);

  if (loading) {
    return (
      <div className="discussion-result-main" style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"80vh" }}>
        <div>결과를 불러오는 중…</div>
      </div>
    );
  }

  if (error && !roomResult) {
    // 이 경우는 모의 데이터까지 생성되지 못했을 때만
    return (
      <div className="discussion-result-main" style={{ padding:"40px" }}>
        <p style={{ color:'#c00', fontWeight:800 }}>결과를 불러오지 못했습니다.</p>
        <pre style={{ background:'#fff', padding:'12px', borderRadius:8, border:'1px solid #eee' }}>{String(error || 'no_data')}</pre>
      </div>
    );
  }

  return (
    <div className="discussion-result-main" style={{ display:"flex", flexDirection:"row", alignItems:"flex-start", gap:"24px" }}>
      {/* 좌측 히어로 섹션 (고정, 비스크롤) */}
      <section className="dr-hero">
        <div className="dr-hero-body">

          <div className="dr-hero-copy">
            <p className="dr-hero-headline">
              멋진데요? 열띤 토론 덕에
뚜레주르의 ‘겹겹이초코퐁당’이
수레만큼 가득 모였어요.
            </p>
          <div className="dr-hero-visual">
            {/* TODO: 케이크/보트 모형 이미지 교체 */}
            <img className="dr-hero-img" src={heroSheep} alt="토론 열기 케이크 시각화" />
          </div>
            <div className="dr-hero-summary">
                      <img className="badge-img" src={aiIcon} alt="aiIcon"/>
              <div className="dr-hero-summary-text">
                {overallSummary ? 
                  overallSummary
                 : 
                  "총평을 준비하고 있습니다…"
                }
              </div>
            </div>
            <div className="dr-hero-actions">
              <SavePDFButton/>
              <NextSessionButton/>
            </div>
          </div>
        </div>
      </section>

      {/* 우측 스크롤 영역: 나의 레포트 + 랭킹 */}
      <div className="dr-scroll-area">
        {/* 나의 레포트 */}
        <section className="dr-my-report card">
          <div className="dr-card-header">
            <h2>{myNickname ? `나의 첫번째 토론 레포트` : '나의 토론 레포트'}</h2>
          </div>

          <div className="dr-card-body-2x2">
            {/* 1: 나의 등수/프로필 */}
            <div className="dr-profile">
              <div className="dr-top-quote-head">
                <span>나의 등수</span>
              </div>
<div className="my-avatar-wrap">
  <img className="avatar avatar--lg" src={myAvatar} alt="내 프로필" />
  <div className="badge badge--overlay-lg">{rankLabel(myResult?.rank)}</div>
</div>
            </div>

            {/* 2: 인재상 분포 */}
            <div className="dr-distribution">
              <div className="dr-top-quote-head">
                <span>인재상 분포</span>
              </div>
              <div className="dr-donut-wrap">
                <img className="dr-donut" src={donutPlaceholder} alt="인재상 분포 도넛" />
              </div>
            </div>

            {/* 3: 참여 횟수 */}
            <div className="dr-participation">
               <div className="dr-top-quote-head">
                <span>참여 횟수</span>
              </div>
                  <div className="result-summary-box">
      <span className="result-summary-item lk"><i className="icon"/>+{myResult?.totalReactions || 0}건</span>
      <span className="result-summary-item ch"><i className="icon"/>+{myResult?.totalMessages || 0}건</span>
    </div>
                      <div className="result-category-summary-box">
      <span className="result-category-summary-item j"><i className="icon"/>+{myResult?.totalReactions || 0}건</span>
      <span className="result-category-summary-item p"><i className="icon"/>+{myResult?.totalReactions || 0}건</span>
      <span className="result-category-summary-item c"><i className="icon"/>+{myResult?.totalReactions || 0}건</span>
      <span className="result-category-summary-item r"><i className="icon"/>+{myResult?.totalMessages || 0}건</span>
    </div>
            </div>

            

            {/* 4: 가장 공감을 많이 받은 발언 */}
            <div className="dr-top-quote">
              <div className="dr-top-quote-head">
                <span>가장 공감을 많이 받은 발언</span>
                                <span className="likes-badge">
                  <i className="icon" />
                  {myResult?.topReacted?.reactionsCount ?? 0}
                </span>
                </div>
              <div className="dr-quote">
                {myResult?.topReacted?.text || '베스트 메시지가 없습니다.'}
              </div>
            </div>
          </div>
        </section>

        {/* 전체 랭킹 
        <aside className="dr-ranking card">
          <header className="dr-card-header">
            <h3>전체 랭킹</h3>
          </header>
          <ol className="dr-ranking-list">
            {topN.map((r, idx) => (
              <li key={r.nickname} className={`dr-ranking-item ${rankClass(idx)}`}>
                <div className="avatar-wrap">
                  <img className="avatar" src={user1Avatar} alt={`${r.nickname}`} />
                  <div className="badge badge--overlay">{rankLabel(r.rank)}</div>
                </div>
                <div className="meta">
                  <div className="name">{r.nickname}</div>
                  <div className="sub">❤️ {r.totalReactions} · 💬 {r.totalMessages}</div>
                </div>
              </li>
            ))}
          </ol>
        </aside>*/}
      </div>
    </div>
  );
}

function rankSuffix(rank){
  if (!rank || typeof rank !== 'number') return '';
  if (rank === 1) return 'ST';
  if (rank === 2) return 'ND';
  if (rank === 3) return 'RD';
  return 'TH';
}
function rankLabel(rank){
  if (!rank || typeof rank !== 'number') return '-';
  if (rank === 1) return '1ST';
  if (rank === 2) return '2ND';
  if (rank === 3) return '3RD';
  return `${rank}TH`;
}
function rankClass(idx){
  if (idx === 0) return 'first';
  if (idx === 1) return 'second';
  if (idx === 2) return 'third';
  return '';
}
function badgeKey(k){
  // 정직/열정/창의/존중 → justice/passion/creativity/respect (파일명 키 예시)
  if (k === '정직') return 'justice';
  if (k === '열정') return 'passion';
  if (k === '창의') return 'creativity';
  if (k === '존중') return 'respect';
  return 'badge';
}
