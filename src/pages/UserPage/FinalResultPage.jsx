import { lessons, quizResults } from '../../contents/financial-course.js';
import badgeJustice from '@/assets/images/discussion/badge_1.png';
import badgePassion from '@/assets/images/discussion/badge_2.png';
import badgeRespect from '@/assets/images/discussion/badge_4.png';
import badgeCreativity from '@/assets/images/discussion/badge_3.png';
import '../../components/user/finalResult/finalResult.css';
import NextSessionButton from '../../components/user/finalResult/NextSessionButton.jsx';
import SavePDFButton from '../../components/user/finalResult/SavePDFButton.jsx';
import PageHeader from '../../components/common/PageHeader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import myAvatar from "@/assets/images/avatar/avatar2.png";
import aiIcon from "@/assets/images/discussion/AI_icon.png";
import avatar1 from "@/assets/images/avatar/avatar1.png";
import avatar2 from "@/assets/images/avatar/avatar2.png";
import avatar3 from "@/assets/images/avatar/avatar3.png";
import avatar4 from "@/assets/images/avatar/avatar4.png";
import avatar5 from "@/assets/images/avatar/avatar5.png";
import avatar6 from "@/assets/images/avatar/avatar6.png";
import avatar7 from "@/assets/images/avatar/avatar7.png";
import avatar8 from "@/assets/images/avatar/avatar8.png";
import avatar9 from "@/assets/images/avatar/avatar9.png";
import avatar10 from "@/assets/images/avatar/avatar10.png";
import avatar11 from "@/assets/images/avatar/avatar11.png";
import avatar12 from "@/assets/images/avatar/avatar12.png";
import { useNavigate } from "react-router-dom";

import { http } from '@/lib/http' ;
import { quizApi } from '@/api/quiz' ;
export default function FinalResultPage() {
    const avatars = [
      { id: '1', src: avatar1 },
      { id: '2', src: avatar2 },
      { id: '3', src: avatar3 },
      { id: '4', src: avatar4 },
      { id: '5', src: avatar5 },
      { id: '6', src: avatar6 },
      { id: '7', src: avatar7 },
      { id: '8', src: avatar8 },
      { id: '9', src: avatar9 },
      { id: '10', src: avatar10 },
      { id: '11', src: avatar11 },
      { id: '12', src: avatar12 },
    ];
      function findAvatarById(id) {
    const found = avatars.find(a => a.id === id);
    return found ? found.src : avatar1;
  }
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const roomId = useMemo(() => search.get('roomId') || location.state?.roomId || localStorage.getItem('roomId') || 'general', [location.search, location.state]);
  const nickname = useMemo(() => search.get('nickname') || location.state?.nickname || localStorage.getItem('nickname') || '', [location.search, location.state]);
  const learnedAtStr = useMemo(() => new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' }), []);
  const { avatarUrl,isAdmin,setIsAdmin } = useUser();
  // admin override via URL param: ?admin or ?admin=1
  const isAdminEffective = isAdmin || search.has('admin');

  // Admin-controlled nickname selection
  const [adminTargetNick, setAdminTargetNick] = useState(nickname);
  const effectiveNick = (isAdminEffective ? (adminTargetNick || nickname) : nickname);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [quiz, setQuiz] = useState(null);

  const selectedVideoSet = lessons.map(lesson => lesson.videoId);

  const donutRef = useRef(null);
  const lineRef = useRef(null);
  const donutChartRef = useRef(null);
  const lineChartRef = useRef(null);
  // ADD
  const barsRef = useRef(null);
  const barsChartRef = useRef(null);
  // Track which nicknames have already had pre-generation fired
  const pregenFiredRef = useRef(new Set());

  async function ensureChartJS(){
    if (window.Chart) return window.Chart;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
    return window.Chart;
  }

  useEffect(() => {
    let aborted = false;
    async function fetchData(){
      setLoading(true); setError('');
      try {
        // 멀티 비디오 통합 결과 호출
        const created = await http.post(`/api/review/${encodeURIComponent(roomId)}/multi-final-result`, {
          nickname: effectiveNick || '',
          videoIds: selectedVideoSet,
        });
        console.log('[FinalResultPage] multi-final-result:', created);
        if (!aborted) setData(created);
      } catch (e) {
        if (!aborted) {
          setData(null);
          setError('종합 결과를 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');
        }
      } finally {
        // 3) 퀴즈 결과는 GET/POST 결과와 무관하게 시도
        try{
          const qres = isAdminEffective ? null : await quizApi.getMyScores();
          if (!aborted) setQuiz({ rounds: quizResults(qres) });
        } catch {
          if (!aborted) setQuiz({ rounds: quizResults(null) });
        }
        if (!aborted) setLoading(false);
      }
    }
    fetchData();
    return () => { aborted = true };
  }, [roomId, effectiveNick, isAdminEffective]);

  // Log when data/quiz states are updated (for real API integration later)
  useEffect(() => {
    if (data?.sections) {
      try { console.log('[FinalResultPage] sections (state):', data.sections); } catch {}
    }
    if (quiz?.rounds) {
      try { console.log('[FinalResultPage] quiz (state):', quiz.rounds); } catch {}
    }
  }, [data, quiz]);

  const sections = data?.sections;
  // Admin pre-generation: when admin opens FinalResultPage, trigger generation for all users once
  useEffect(() => {
    if (!isAdminEffective) return;
    if (!roomId) return;
    const ranking = Array.isArray(sections?.ranking) ? sections.ranking : [];
    if (!ranking.length) return;
    const uniqNicks = Array.from(new Set(ranking.map((r) => r?.nickname).filter(Boolean)));
    // stagger to avoid burst
    uniqNicks.forEach((nick, idx) => {
      if (nick === effectiveNick) return; // skip the one we're currently viewing
      const key = `${roomId}::${nick}`;
      if (pregenFiredRef.current.has(key)) return;
      pregenFiredRef.current.add(key);
      setTimeout(() => {
        http.post(`/api/review/${encodeURIComponent(roomId)}/multi-final-result`, {
          nickname: nick,
          videoIds: selectedVideoSet,
        }).catch(() => {/* swallow errors; this is best-effort pregen */});
      }, idx * 300);
    });
  }, [isAdminEffective, roomId, sections?.ranking, effectiveNick]);


  // --- Adapt server's video-based arrays to the existing round-based variables (UI text unchanged) ---
  const videoAsRounds = useMemo(() => {
    const personaByVideo = sections?.personaByVideo || [];
    const participationByVideo = sections?.participationByVideo || [];

    const personaByRoundFromVideo = Array.isArray(personaByVideo) && personaByVideo.length
      ? personaByVideo.map((v, idx) => ({
          round_number: Number.isInteger(Number(v.video)) ? Number(v.video) + 1 : idx + 1,
          labels: { ...(v.labels || {}) },
        }))
      : [];

    const participationByRoundFromVideo = Array.isArray(participationByVideo) && participationByVideo.length
      ? participationByVideo.map((v, idx) => ({
          round_number: Number.isInteger(Number(v.video)) ? Number(v.video) + 1 : idx + 1,
          totalMessages: Number(v.totalMessages || 0),
          totalReactions: Number(v.totalReactions || 0),
          // myMessages / myReactions are not provided per-video; keep 0 so chart renders without mock fallback
          myMessages: Number(v.myMessages || 0),
          myReactions: Number(v.myReactions || 0),
        }))
      : [];

    return { personaByRoundFromVideo, participationByRoundFromVideo };
  }, [sections]);
  const overall = sections?.overall || { rank:null, score:null, totalMessages:0, totalReactions:0 };
  const personaIntegrated = sections?.personaIntegrated || { counts:{}, percentages:{} };
  const personaByRound = (sections?.personaByRound && sections.personaByRound.length)
    ? sections.personaByRound
    : videoAsRounds.personaByRoundFromVideo;

  const participation = (sections?.participationByRound && sections.participationByRound.length)
    ? sections.participationByRound
    : videoAsRounds.participationByRoundFromVideo;

  const top3 = sections?.top3Statements || [];
  const aiSummary = sections?.aiSummary || '';
  // 유틸
  const pct = (v) => typeof v === 'number' ? `${v}%` : (Number(v)||0)+"%";
  const p = personaIntegrated.percentages;

  const pComputed = p && Object.keys(p).length ? p : (()=>{
    const counts = personaIntegrated.counts || {};
    const sum = Object.values(counts).reduce((a,b)=>a+(b||0),0) || 1;
    return Object.fromEntries(Object.entries(counts).map(([k,v])=>[k, Math.round(((v||0)/sum)*1000)/10]));
  })();

  // 랭크/아바타 티어/퍼센타일 유틸
  const totalParticipants = Array.isArray(sections?.ranking) ? sections.ranking.length : 0;
  const topPercent = (overall?.rank && totalParticipants) ? Math.round((overall.rank/totalParticipants)*1000)/10 : null; // 상위 X%
  const rankTier = (r) => {
    if (!r) return 'normal';
    if (r === 1) return 'gold';
    if (r === 2) return 'silver';
    if (r === 3) return 'bronze';
    return 'normal';
  };
  const avatarTierClass = `frp-avatar--${rankTier(overall?.rank)}`;
  const rankBadgeClass = `frp-rank-badge--${rankTier(overall?.rank)}`;

    const navigate = useNavigate();
    const handleClick = () => {
    // PDF 저장 기능은 별도 구현 필요
    alert("PDF 저장 기능은 추후 구현됩니다.");
  };

  useEffect(() => {
    if (!sections) return;
    let alive = true;
    (async () => {
      const Chart = await ensureChartJS();
      if (!alive) return;

      // Colors aligned with CSS swatches
      const C = {
        justice: '#f39c12', // 금융이해
        passion: '#e74c3c', // 위험인식
        respect: '#ff7f50', // 실천의지
        creativity: '#f1c40f', // 계획성
        round1: '#3a7bd5',
        round2: '#ff6b6b',
        round3: '#f4a261',
      };

      // --- Donut (integrated persona) ---
      const donutCtx = donutRef.current?.getContext('2d');
      if (donutCtx){
        donutChartRef.current?.destroy?.();
        const labels = ['금융이해','위험인식','실천의지','계획성'];
        const vals = labels.map(k => Number(pComputed?.[k]||0));
        const nonZeroCount = vals.filter(v => v > 0).length;
        const totalVal = vals.reduce((a, b) => a + b, 0);
        if (!nonZeroCount || totalVal <= 0){
          donutChartRef.current = new Chart(donutCtx, {
            type: 'doughnut',
            data: {
              labels: ['데이터 없음'],
              datasets: [{ data: [1], backgroundColor: ['#EDEDED'], borderWidth: 0 }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: true,
              cutout: '65%',
              layout: { padding: { left: 24, right: 24, top: 30, bottom: 30 } },
              plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
          });
          // No data: render placeholder donut only, continue to build other charts
        }
        if (nonZeroCount && totalVal > 0) {
        // Rank-based colors (1~4): 1:#FF6620, 2:#FFCE7B, 3:#FFE3B3, 4:#EDEDED
        const RANK_COLORS = ['#FF6620', '#FFCE7B', '#FFE3B3', '#EDEDED'];
        // sort indices by value desc
        const sortedForColor = [...vals].map((v,i)=>({ v, i })).sort((a,b)=> b.v - a.v);
        const colorByIndex = Array(vals.length);
        sortedForColor.forEach((o, rank) => { colorByIndex[o.i] = RANK_COLORS[rank] || RANK_COLORS[RANK_COLORS.length-1]; });

        // Create rank-based size mapping: 1st=156, 2nd/3rd=122, 4th=76
        const sorted = sortedForColor; // reuse the same ranking for sizing
        const sizeMap = {};
        sorted.forEach((o, rank) => {
          if (rank === 0) sizeMap[o.i] = 156;
          else if (rank === 1 || rank === 2) sizeMap[o.i] = 122;
          else sizeMap[o.i] = 76;
        });

        // --- Badge images for persona labels (Vite-safe asset paths) ---
        const badgeSources = {
          '금융이해': badgeJustice,
          '위험인식': badgePassion,
          '실천의지': badgeRespect,
          '계획성': badgeCreativity,
        };
        const badgeImages = {};
        Object.entries(badgeSources).forEach(([k, src]) => {
          const img = new Image();
          img.src = src; // vite 빌드 시, 실제 경로로 교체
          badgeImages[k] = img;
        });

        // After badgeImages, build rank-based badgeSizes array
        const badgeSizes = vals.map((_, i) => sizeMap[i]);

        // --- Compute dynamic side padding based on largest badge + label block ---
        const maxBadge = Math.max(...badgeSizes);
        const labelBlockH = 24; // label + gap height allowance
        const sideBandPad = Math.ceil(maxBadge/2) + labelBlockH + 16; // half badge + label + margin

        // Plugin: pin badges to left/right bands with single-elbow connectors, max 2 per side
        const badgePlugin = {
          id: 'persona-badges',
          afterDatasetsDraw(chart){
            const { ctx, chartArea } = chart;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;

            // Geometry (donut center & radius)
            const base = meta.data[0].getProps(['x','y','outerRadius'], true);
            const cx = base.x, cy = base.y, R = base.outerRadius;

            // Build items from arcs (anchor points)
            const items = meta.data.map((arc, idx) => {
              const label = chart.data.labels[idx];
              const img = badgeImages[label];
              if (!img) return null;
              const props = arc.getProps(['x','y','startAngle','endAngle','innerRadius','outerRadius'], true);
              const angle = (props.startAngle + props.endAngle) / 2;
              const ax = props.x + Math.cos(angle) * (props.outerRadius + 6);
              const ay = props.y + Math.sin(angle) * (props.outerRadius + 6);
              const onRight = Math.cos(angle) >= 0; // initial side by anchor
              const size0 = badgeSizes[idx] || 76;
              const value = Math.round((pComputed?.[label] ?? 0) * 10) / 10;
              return { idx, label, img, angle, ax, ay, onRight, size0, value };
            }).filter(Boolean);

            // Split into sides
            let left = items.filter(it => !it.onRight);
            let right = items.filter(it =>  it.onRight);

            // Rebalance so each side has at most 2 badges.
            function rebalance(from, to, isRightFrom){
              // Move the item(s) whose anchor X is closest to center first
              while (from.length > 2){
                from.sort((a,b) => Math.abs(a.ax - cx) - Math.abs(b.ax - cx));
                const mv = from.shift();
                mv.onRight = !isRightFrom;
                to.push(mv);
              }
            }
            // Prefer to move overflow from the more crowded side first
            if (right.length > 2) rebalance(right, left, true);
            if (left.length  > 2) rebalance(left,  right, false);

            // Final sort by Y for neat vertical stacking
            left.sort((a,b)=> a.ay - b.ay);
            right.sort((a,b)=> a.ay - b.ay);

            // Lay out a side with stacking and (if needed) uniform downscale to fit
            function layoutSide(sideItems, isRight){
              if (!sideItems.length) return [];
              const bandTop = chartArea.top + 12;
              const bandBot = chartArea.bottom - 12;
              const bandH = bandBot - bandTop;

              const gap = 12;
              const minSize = 48;
              const sumSizes = sideItems.reduce((s,it)=> s + it.size0, 0);
              const need = sumSizes + gap*(sideItems.length-1);
              const scale = need > bandH
                ? Math.max((bandH - gap*(sideItems.length-1)) / Math.max(sumSizes,1), minSize/Math.max(...sideItems.map(it=>it.size0)))
                : 1;

              const laid = sideItems.map(it => ({
                ...it,
                size: Math.round(it.size0 * scale),
                // base X will be pushed outside the donut in a moment
                bx: isRight ? (chartArea.right - 16) : (chartArea.left + 16),
                by: Math.max(bandTop + Math.round(it.size0*scale)/2, Math.min(bandBot - Math.round(it.size0*scale)/2, it.ay))
              }));

              // Forward pass (push down)
              for (let i=1;i<laid.length;i++){
                const prev = laid[i-1];
                const cur = laid[i];
                const minGap = (prev.size/2 + cur.size/2 + gap);
                if (cur.by - prev.by < minGap){ cur.by = prev.by + minGap; }
              }
              // Backward pass (pull up)
              for (let i=laid.length-2;i>=0;i--){
                const next = laid[i+1];
                const cur = laid[i];
                const minGap = (cur.size/2 + next.size/2 + gap);
                if (next.by > bandBot){ next.by = bandBot - next.size/2; }
                if (next.by - cur.by < minGap){ cur.by = next.by - minGap; }
                if (cur.by < bandTop + cur.size/2){ cur.by = bandTop + cur.size/2; }
              }

              // Push X outside donut with margin, stay inside chartArea edges
              laid.forEach(cur => {
                const margin = 24;
                cur.bx = isRight
                  ? Math.max(cx + R + margin + cur.size/2, chartArea.right - 16 - cur.size/2)
                  : Math.min(cx - R - margin - cur.size/2, chartArea.left + 16 + cur.size/2);
              });

              return laid;
            }

            const laidL = layoutSide(left, false);
            const laidR = layoutSide(right, true);
            const laidAll = [...laidL, ...laidR];

            // Draw (elbow connector + badge + label)
            laidAll.forEach(it => {
              const { img, label, value, ax, ay, bx, by, size, onRight } = it;
              if (!img.complete){ img.onload = () => chart.draw(); return; }
              ctx.save();

              const elbowX = onRight ? (bx - size/2 - 10) : (bx + size/2 + 10);
              const elbowY = ay;
              const endX   = onRight ? (bx - size/2 - 4)  : (bx + size/2 + 4);
              const endY   = by;

              // anchor dot
              ctx.beginPath();
              ctx.arc(ax, ay, 3, 0, Math.PI*2);
              ctx.fillStyle = '#FF6E37';
              ctx.fill();

              // elbow polyline
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(elbowX, elbowY);
              ctx.lineTo(endX, endY);
              ctx.lineWidth = 2;
              ctx.lineJoin = 'round';
              ctx.strokeStyle = '#FF6E37';
              ctx.stroke();

              // badge image
              ctx.drawImage(img, bx - size/2, by - size/2, size, size);

              // label under badge (one line)
              ctx.font = '18px sans-serif';
              ctx.textBaseline = 'top';
              const labelText = `${label} `;
              const percentText = `${value}%`;

              // measure to keep total centered
              const wLabel = ctx.measureText(labelText).width;
              const wPercent = ctx.measureText(percentText).width;
              const totalW = wLabel + wPercent;
              const baseY = by + size/2 + 6;
              let startX = bx - totalW / 2;

              // draw label in neutral color
              ctx.fillStyle = '#333';
              ctx.textAlign = 'left';
              ctx.fillText(labelText, startX, baseY);

              // draw percent in the same rank color as the arc segment
              // use the dataset color for this arc index
              const segColor = (chart.data.datasets?.[0]?.backgroundColor?.[it.idx]) || '#FF6620';
              ctx.fillStyle = segColor;
              ctx.fillText(percentText, startX + wLabel, baseY);

              // restore textAlign for downstream code (safety)
              ctx.textAlign = 'center';

              ctx.restore();
            });
          }
        };

        donutChartRef.current = new Chart(donutCtx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: vals,
              backgroundColor: colorByIndex,
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: true,
            cutout: '65%',
            layout: { padding: { left: sideBandPad, right: sideBandPad, top: 50, bottom: 50 } },
            plugins: { legend: { display: false }, tooltip: { enabled: true } }
          },
          plugins: [badgePlugin]
        });
        }
      }

      // --- Persona by Round (LINE: x=발언 역량 4가지, series=라운드) ---
      const lineCtx = lineRef.current?.getContext('2d');
      if (lineCtx){
        lineChartRef.current?.destroy?.();
        const traitLabels = ['금융이해','위험인식','실천의지','계획성'];
        const colorPool = [C.round1, C.round2, C.round3, '#9b59b6', '#16a085'];
        const datasets = (personaByRound || []).map((r, idx) => ({
          label: `R${r.round_number ?? (idx+1)}`,
          data: traitLabels.map(t => Number(r?.labels?.[t] || 0)),
          borderColor: colorPool[idx % colorPool.length],
          backgroundColor: colorPool[idx % colorPool.length],
          tension: 0,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 4,
        }));
        lineChartRef.current = new Chart(lineCtx, {
          type: 'line',
          data: { labels: traitLabels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: true,
            plugins: { legend: { display: true, position: 'bottom' } },
            interaction: { mode: 'nearest', intersect: false },
            scales: {
              x: { },
              y: { beginAtZero: true, ticks: { precision: 0 } }
            }
          }
        });
      }

      // --- Bars: 토론별 참여도(나 or 전체) ---
      const barsCtx = barsRef.current?.getContext('2d');
      if (barsCtx){
        barsChartRef.current?.destroy?.();
        const labels = (participation || []).map((r, idx) => `토론 ${r.round_number ?? (idx+1)}`);
        const myArr = (participation || []).map(r => Number(r?.myMessages || 0));
        const totArr = (participation || []).map(r => Number(r?.totalMessages || 0));
        const useMine = myArr.some(v => v > 0);
        const dataArr = useMine ? myArr : totArr;
        const dataLabel = useMine ? '나의 메시지 수' : '전체 메시지 수';
        barsChartRef.current = new Chart(barsCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: dataLabel, data: dataArr, backgroundColor: '#3a7bd5', yAxisID: 'y' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: true,
            plugins: { legend: { display: true, position: 'bottom' } },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: '메시지 수' } }
            }
          }
        });
      }

    })();

    return () => {
      alive = false;
      donutChartRef.current?.destroy?.();
      lineChartRef.current?.destroy?.();
      barsChartRef.current?.destroy?.();
    };
  }, [sections, quiz]);

  if (loading){
    return (
      <div className="final-result-page">
        <div className="frp-topbar">
          <h2 className="frp-topbar__title">{effectiveNick ? `${effectiveNick}의 학습 레포트` : '학습 레포트'}</h2>
          <div className="frp-topbar__date">학습일: {learnedAtStr}</div>
        </div>
        <div style={{padding:20}}>결과를 불러오는 중…</div>
      </div>
    );
  }
  if (error){
    return (
      <div className="final-result-page">
        <div className="frp-topbar">
          <h2 className="frp-topbar__title">{effectiveNick ? `${effectiveNick}의 학습 레포트` : '학습 레포트'}</h2>
          <div className="frp-topbar__date">학습일: {learnedAtStr}</div>
        </div>
        <div style={{padding:20,color:'#c0392b'}}>{error}</div>
      </div>
    );
  }

  return (
    <div className={`final-result-page ${isAdminEffective ? 'is-admin' : ''}`}>
      <PageHeader title={"전체 결과 대시보드"} />
      <div className="frp-topbar">
        {isAdminEffective && (
          <div className="frp-admin-switcher" style={{ position:'absolute', left:0, top:0, display:'flex', alignItems:'center', gap:8 }}>
            <label htmlFor="frp-admin-nick" className="frp-admin-switcher__label" style={{ fontSize:12, color:'#666' }}></label>
            <select
              id="frp-admin-nick"
              className="frp-admin-switcher__select"
              value={adminTargetNick || ''}
              onChange={(e)=> setAdminTargetNick(e.target.value)}
              style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:6 }}
            >
              {Array.isArray(sections?.ranking) && sections.ranking.length > 0 ? (
                sections.ranking.map((r, idx) => (
                  <option key={`${r.nickname}-${idx}`} value={r.nickname}>{r.nickname}</option>
                ))
              ) : (
                <option value={nickname || ''}>{nickname || '나'}</option>
              )}
            </select>
          </div>
        )}
        <h2 className="frp-topbar__title">{effectiveNick ? `${effectiveNick}의 학습 레포트` : '학습 레포트'}</h2>
        <div className="frp-topbar__date">학습일: {learnedAtStr}</div>
      </div>

<div className='frp-dashboard'>
      {/* SECTION 1: 통합 등수/점수 + AI 요약 + 학습 완수율(총괄 메시지/반응을 진행률처럼 표시) */}
      <section className="frp-section frp-section--1">
        <article className="frp-card frp-rank">
          <header className="frp-card__header">
            <h3>통합 등수 및 점수</h3>
          </header>
          <div className="frp-rank__body">
            <div className="frp-avatarWrap">
              <div className={`frp-avatar ${avatarTierClass}`} aria-label={overall.rank ? `${overall.rank}위 아바타` : '아바타'}>

              <img className="avatar-small" src={findAvatarById(avatarUrl)} alt="내 프로필" />
              </div>
              {overall.rank ? (
                <div className={`frp-rank-badge ${rankBadgeClass}`} title={`순위 ${overall.rank}위`}>
                  {overall.rank}
                </div>
              ) : null}
            </div>
            <div className="frp-avatar__footer">
              <div className="frp-avatar__score">
                <strong>{overall.score != null ? `${Math.round(overall.score*10)/10} 점` : '—'}</strong>
                {/*topPercent != null && <span className="frp-avatar__percent">상위 {topPercent}%</span>*/}
              </div>
            </div>
          </div>
        </article>

        <article className="frp-card frp-ai-summary">
          <header className="frp-card__header">
            <h3>AI 요약</h3>
          </header>
          <div className="frp-ai-summary__body">
            <img className="frp-ai-summary__icon" src={aiIcon} alt="AI" />
            {aiSummary ? (
              <p className="frp-ai-summary__text">{aiSummary}</p>
            ) : (
              <p className="frp-ai-summary__text">요약이 없습니다. (내 발화가 부족하거나 AI 요약 비활성화)</p>
            )}
          </div>
        </article>

        <article className="frp-card frp-completion">
          <header className="frp-card__header">
            <h3>차시별 퀴즈 결과</h3>
          </header>
          <div className="frp-completion__body">
            <p>{isAdminEffective ? '개별 퀴즈 점수는 학생 본인의 종합 화면에서 확인할 수 있습니다.' : '1·2차시 선택형 문항의 정답 수입니다. 3·4차시는 퀴즈를 진행하지 않습니다.'}</p>
            <div className="frp-completion__details">
              <ul className="frp-circle-list">
                {(quiz?.rounds || quizResults(null)).map(result => (
                  <li key={result.round_number} className="frp-circle">
                    <div className="frp-circle__ring">
                      <div className="frp-circle__value">{result.correctCount == null ? '—' : `${result.correctCount}/${result.totalQuestions}`}</div>
                    </div>
                    <div className="frp-circle__label">{result.round_number}차시 · {result.status === 'not_applicable' ? '퀴즈 없음' : result.totalQuestions ? (isAdminEffective ? '학생 화면에서 확인' : result.correctCount == null ? '기록 없음' : '정답') : '자료 준비 중'}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>

      {/* SECTION 2: 발언 역량 통합 분포(도넛) + 라운드별 발언 역량 분포(꺾은선-플레이스홀더) */}
      <section className="frp-section frp-section--2">
        <article className="frp-card frp-donut">
          <header className="frp-card__header"><h3>발언 역량 통합 분포</h3></header>
          <div className="frp-donut__wrap">
            <canvas ref={donutRef} className="frp-donut__chart" aria-label="발언 역량 도넛" />
          </div>
        </article>

        <article className="frp-card frp-line">
          <header className="frp-card__header"><h3>라운드별 발언 역량 분포</h3></header>
          <div className="frp-line__chart" aria-hidden="false">
            <canvas ref={lineRef} style={{width:'100%', height:'100%'}} />
          </div>
          <footer className="frp-card__footer frp-legend--inline">
            {personaByRound.length ? "": <span className="frp-muted">데이터 없음</span>}
          </footer>
        </article>
      </section>

      {/* SECTION 3: 토론별 참여도 + 공감 TOP3 */}
      <section className="frp-section frp-section--3">
        <article className="frp-card frp-bars">
          <header className="frp-card__header"><h3>토론별 참여도</h3></header>
          <div className="frp-bars__chart" aria-hidden="false">
            <canvas ref={barsRef} />
          </div>
        </article>

        <article className="frp-card frp-top3">
          <header className="frp-card__header"><h3>공감을 많이 받은 발언 TOP3</h3></header>
          <ol className="frp-top3__list">
            {top3.length ? top3.map((m, i) => (
              <li key={i}>
                <div className="badge">{i+1}</div>
                <div className="frp-top3__content">
                  <p>{m.text}</p>
                  <div className="frp-top3__meta">
                    <span className="frp-top3__count">공감 {m.reactionsCount ?? 0}</span>
                  </div>
                </div>
              </li>
            )) : (
              <li>
                <div className="badge">-</div>
                <div className="frp-top3__content"><p className="frp-muted">데이터 없음</p></div>
              </li>
            )}
          </ol>
        </article>
      </section>
          <button
      className="save-pdf-button"
      onClick={() => {
          navigate("/user/end");
      }}
    >
      종료하기
    </button>
    {/*
      <button className="next-session-button" onClick={handleClick}>
      PDF 저장
      </button> 
    */}
      </div>

    </div>
  );
}