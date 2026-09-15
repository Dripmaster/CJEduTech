import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import './overallRanking.css';

// 탑(타워) 이미지 — 배포 경로 문제 없도록 import
import cakeTower from '@/assets/images/discussion/cake_tower.png';

// 아바타들 (없으면 순환 사용)
import avatar1 from '@/assets/images/avatar/avatar1.png';
import avatar2 from '@/assets/images/avatar/avatar2.png';
import avatar3 from '@/assets/images/avatar/avatar3.png';
import avatar4 from '@/assets/images/avatar/avatar4.png';
import avatar5 from '@/assets/images/avatar/avatar5.png';
import avatar6 from '@/assets/images/avatar/avatar6.png';
import avatar7 from '@/assets/images/avatar/avatar7.png';
import avatar8 from '@/assets/images/avatar/avatar8.png';
import avatar9 from '@/assets/images/avatar/avatar9.png';
import avatar10 from '@/assets/images/avatar/avatar10.png';
import avatar11 from '@/assets/images/avatar/avatar11.png';
import avatar12 from '@/assets/images/avatar/avatar12.png';

const AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8, avatar9, avatar10, avatar11, avatar12];

const useTowerHeight = () => {
  const imgRef = useRef(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight || el.naturalHeight || 0);
    update();
    let ro;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    el.addEventListener('load', update);
    const t = setTimeout(update, 200);
    return () => {
      clearTimeout(t);
      el.removeEventListener('load', update);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, []);
  return { imgRef, height };
};

function rankSuffix(n){
  if (n===1) return 'ST'; if (n===2) return 'ND'; if (n===3) return 'RD'; return 'TH';
}

/**
 * props:
 *  ranking: Array<{
 *    rank:number, nickname:string, avatar?:string,
 *    stats?:{ justice?:number, passion?:number, creativity?:number, respect?:number, likes?:number, messages?:number }
 *  }>
 */
export default function OverallRankingCard({ ranking = [], perUser = {}, avatarMap = {} }){
  const list = useMemo(() => {
    if (Array.isArray(ranking) && ranking.length) {
      return ranking.slice(0, 20).map((r, idx) => {
        const info = perUser?.[r.nickname] || {};
        const labels = info.labels || {};
          const aid = avatarMap?.[r.nickname];
          const avatar = (aid && !Number.isNaN(Number(aid)))
            ? AVATARS[(Number(aid)-1) % AVATARS.length]
            : (r.avatar || AVATARS[idx % AVATARS.length]);
        return {
          rank: r.rank,
          nickname: r.nickname,

          avatar,
          
          
          
          stats: {
            justice: Number(labels['금융이해'] || 0),
            passion: Number(labels['위험인식'] || 0),
            creativity: Number(labels['계획성'] || 0),
            respect: Number(labels['실천의지'] || 0),
            likes: Number((info.totalReactions ?? r.totalReactions) || 0),
            messages: Number((info.totalMessages ?? r.totalMessages) || 0)
          }
        };
      });
    }
    // mock 1..20
    return Array.from({ length: 20 }).map((_, i) => ({
      rank: i + 1,
      nickname: `참가자${i + 1}`,
      avatar: AVATARS[i % AVATARS.length],
      stats: { justice: 12, passion: 10, creativity: 8, respect: 6, likes: 12 + i, messages: 10 + i }
    }));
  }, [ranking, perUser]);

  const { imgRef: towerImgRef, height: towerHeight } = useTowerHeight();
  const listGridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateRows: `repeat(${Math.max(list.length, 1)}, 1fr)`,
    height: towerHeight ? `${towerHeight}px` : 'auto'
  }), [list.length, towerHeight]);

  return (
    <section className="overall-ranking-card card">
      <header className="orc-header"><h3>전체 토론 랭킹</h3></header>
      <div className="orc-body">
        {/* 좌측 탑 이미지 */}
        <div className="orc-tower">
          <img ref={towerImgRef} src={cakeTower} alt="케이크 탑" />
        </div>

        {/* 우측 지그재그 1~20위 목록 */}
        <ol className="orc-list" style={listGridStyle}>
          {list.map((u, idx) => {
            const side = idx % 2 === 0 ? 'left' : 'right';
            const ava = u.avatar || AVATARS[idx % AVATARS.length];
            return (
              <li key={u.nickname+idx} className={`orc-item ${side}`}>
                {/* 탑과 연결되는 점/선 */}
                <div className="rank-dot"/>
                <div className="rank-line"/>

                {/* 순위 + 아바타 필 */}
                <div className="rank-pill">
                  <span className="rank-num">{u.rank}<small>{rankSuffix(u.rank)}</small></span>
                  <img className="rank-avatar" src={ava} alt={u.nickname} />
                </div>

                {/* 호버 시 상세 툴팁 카드 */}
                <div className="rank-tooltip">
                  <div className="rt-title">
                    <span className="rt-rank">{u.rank}{rankSuffix(u.rank)}</span>
                    <span className="rt-name">{u.nickname}</span>
                  </div>
                  <div className="rt-stats">
                    <div className="rt-row"><span className="ico ico-j"/>{`+${u?.stats?.justice ?? 0}건`} <span className="ico ico-p"/>{`+${u?.stats?.passion ?? 0}건`}</div>
                    <div className="rt-row"><span className="ico ico-c"/>{`+${u?.stats?.creativity ?? 0}건`} <span className="ico ico-r"/>{`+${u?.stats?.respect ?? 0}건`}</div>
                    <div className="rt-row"><span className="ico ico-like"/>{`+${u?.stats?.likes ?? 0}건`} <span className="ico ico-msg"/>{`+${u?.stats?.messages ?? 0}건`}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}