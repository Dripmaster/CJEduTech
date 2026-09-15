import React, { useMemo, useState } from 'react';
import './talentGroup.css';

// 뱃지/아이콘 (vite import)
import badgeJustice from '@/assets/images/discussion/badge_1.png';
import badgePassion from '@/assets/images/discussion/badge_2.png';
import badgeCreativity from '@/assets/images/discussion/badge_3.png';
import badgeRespect from '@/assets/images/discussion/badge_4.png';
import likeIcon from '@/assets/images/discussion/like.svg';

// 아바타 폴백
import avatar1 from '@/assets/images/avatar/avatar1.png';
import avatar2 from '@/assets/images/avatar/avatar2.png';
import avatar3 from '@/assets/images/avatar/avatar3.png';
import avatar4 from '@/assets/images/avatar/avatar4.png';

const BADGE_BY_TRAIT = {
  '금융이해': badgeJustice,
  '위험인식': badgePassion,
  '계획성': badgeCreativity,
  '실천의지': badgeRespect,
};
const AVATARS = [avatar1, avatar2, avatar3, avatar4];

function rankSuffix(n){
  if (n === 1) return 'ST';
  if (n === 2) return 'ND';
  if (n === 3) return 'RD';
  return 'TH';
}

/**
 * props:
 *  - trait: '금융이해' | '위험인식' | '계획성' | '실천의지'
 *  - members: Array<{ nickname:string, avatar?:string, topReacted?:{ text:string, reactionsCount:number } }>
 *    ※ members는 topReacted.reactionsCount 내림차순으로 정렬해 1..N 순위 부여
 *  - maxRows?: number  // (옵션) 시각적 제한. 스크롤은 기본 활성화
 */
export default function TalentGroupCard({ trait='금융이해', members=[], hideLikes=false, maxRows, loading=false, placeholderCount=3 }) {
  const icon = BADGE_BY_TRAIT[trait];

  const list = useMemo(() => {
    const safe = Array.isArray(members) ? members.slice() : [];
    safe.sort((a,b) => (b?.topReacted?.reactionsCount || 0) - (a?.topReacted?.reactionsCount || 0));
    return safe.map((m, i) => ({
      rank: i + 1,
      nickname: m?.nickname || `참여자${i+1}`,
      avatar: m?.avatar || AVATARS[i % AVATARS.length],
      topReacted: m?.topReacted || { text: '관련 발언이 아직 없어요.', reactionsCount: 0 },
    }));
  }, [members]);

  const rows = typeof maxRows === 'number' ? list.slice(0, maxRows) : list;

  const skeletonRows = Array.from({ length: Math.max(1, placeholderCount) }).map((_, i) => ({
    rank: i + 1,
    nickname: '로딩중…',
    avatar: AVATARS[i % AVATARS.length],
    topReacted: { text: '발언 요약 생성중…', reactionsCount: 0 },
    __skeleton: true,
  }));

  const [openMap, setOpenMap] = useState(() => new Map());
  const toggleOpen = (key) => {
    setOpenMap(prev => {
      const next = new Map(prev);
      next.set(key, !next.get(key));
      return next;
    });
  };

  return (
    <section className="tg-card card">
      <header className="tg-header">
        <h3 className="tg-title">{trait}</h3>
      </header>

      <div className="tg-divider" />

      <ol className="tg-list" role="list">
        {(loading ? skeletonRows : rows).map((m) => (
          <li className={`tg-item ${m.__skeleton ? 'tg-item--skeleton' : ''}`} key={`${trait}-${m.nickname}-${m.rank}`}>
            {/* 순위 + 아바타 */}
            <div className="tg-left">
              <div className={`tg-rank tg-rank--${m.rank <= 3 ? 'gold' : 'plain'}`}>
                <span className="n">{m.rank}</span>
                <small className="suf">{rankSuffix(m.rank)}</small>
              </div>
              <img className="tg-avatar" src={m.avatar} alt={m.nickname} style={m.__skeleton ? { filter:'grayscale(1)', opacity:0.4 } : undefined} />
            </div>

            {/* 닉네임 + 공감 수 + 베스트 발언 */}
            <div className="tg-right">
              <div className="tg-name-row">
                {m.__skeleton ? (
                  <span className="tg-name" style={{ display:'inline-block', width:120, height:16, background:'#eee', borderRadius:6 }} />
                ) : (
                  <span className="tg-name">{m.nickname}</span>
                )}
                {(!hideLikes) && (
                <span className="tg-like-pill" style={m.__skeleton ? { opacity:0.3 } : undefined}>
                  <img src={likeIcon} alt="likes" />
                  {m.topReacted?.reactionsCount ?? 0}
                </span>
                )}
              </div>
                {(() => {
                  const stableKey = `${trait}-${m.nickname}-${m.rank}`;
                  const expanded = !!openMap.get(stableKey);
                  const bubbleStyle = m.__skeleton ? { background:'#f4f4f4', color:'#aaa', cursor:'default' } : undefined;
                  return (
                    <div
                      className={`tg-bubble ${expanded ? 'expanded' : ''}`}
                      role="button"
                      aria-expanded={expanded}
                      title={expanded ? '' : (m.topReacted?.text || '')}
                      onClick={() => { if (!m.__skeleton) toggleOpen(stableKey); }}
                      style={bubbleStyle}
                    >
                      {m.__skeleton ? '발언 요약 생성중…' : (m.topReacted?.text || '베스트 메시지가 없습니다.')}
                    </div>
                  );
                })()}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}