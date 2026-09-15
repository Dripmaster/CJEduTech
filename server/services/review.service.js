// server/services/review.service.js
import { getRoomSnapshot } from './socket.service.js';
import { listRoomArchives } from './socket.service.js';

const AI_BASE = process.env.AI_SERVER_BASE || process.env.AI_BASE || 'http://localhost:8000';

// in-memory cache: roomId -> { summaryText, createdAt, payload }
const overallSummaryCache = new Map();
// in-memory cache: `${baseRoomId}|${nickname}` -> final result blob
const finalResultCache = new Map();
// in-memory cache: `${baseRoomId}|${nickname}|mvid=sortedIds` -> multi video final result blob
const multiFinalResultCache = new Map();

function toBaseRoomId(roomId){
  // strip optional __r{n}
  const m = /^(.+?)__r(\d+)$/.exec(String(roomId||''));
  return m ? m[1] : String(roomId||'');
}
// Aggregate archives for a base room and compute final result
export async function generateFinalResult(roomId, nickname, opts = {}){
  if (!roomId) throw new Error('roomId_required');
  const baseId = toBaseRoomId(roomId);
  const desiredVideoId = (opts && Object.prototype.hasOwnProperty.call(opts, 'videoId')) ? opts.videoId : undefined;
  const vidKey = (typeof desiredVideoId === 'undefined' || desiredVideoId === null) ? 'latest' : String(desiredVideoId);
  const key = `${baseId}|${nickname||''}|vid=${vidKey}`;
  const force = !!opts.force;
  if (!force && finalResultCache.has(key)){
    const cached = finalResultCache.get(key);
    return { roomId: baseId, nickname, cached: true, ...cached };
  }
  let archives = await listRoomArchives(baseId);

  // ---- Video-scoped archive selection (latest per video) ----
  const timeOf = (a) => {
    const t = a?.archivedAt || a?.createdAt || a?.updatedAt || a?.endedAt || a?.timestamp;
    const n = t ? Date.parse(t) : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  // Keep only archives that have explicit video identity
  const validArchives = (archives || []).filter(a =>
    typeof a?.video_id_index !== 'undefined' || typeof a?.video_id_key !== 'undefined'
  );

  // Build a map of latest archive per video id (index or key)
  const latestByVideo = {};
  for (const a of validArchives) {
    const vid = (typeof a.video_id_index !== 'undefined') ? a.video_id_index : a.video_id_key;
    if (!latestByVideo[vid] || timeOf(a) > timeOf(latestByVideo[vid])) {
      latestByVideo[vid] = a;
    }
  }

  let filtered = [];
  if (typeof desiredVideoId !== 'undefined' && desiredVideoId !== null) {
    // If a specific videoId is requested, use only its latest archive
    for (const [vid, a] of Object.entries(latestByVideo)) {
      if (String(vid) === String(desiredVideoId)) {
        filtered.push(a);
        break;
      }
    }
  } else {
    // Otherwise, pick the single most recent archive across all videos
    const latest = Object.values(latestByVideo).sort((x, y) => timeOf(y) - timeOf(x))[0];
    if (latest) filtered = [latest];
  }

  archives = filtered;
  // Stable order (usually single item)
  archives = archives.sort((x,y) => timeOf(x) - timeOf(y));
  // Debug: print aggregation target archives (files) for this run
  try {
    const debugList = (archives || []).map((a, i) => ({
      idx: i,
      video_id_index: a?.video_id_index,
      video_id_key: a?.video_id_key,
      round_number: a?.round_number,
      file: a?.file || a?.filename || a?.path || a?.source || null,
      archivedAt: a?.archivedAt || a?.createdAt || a?.updatedAt || a?.endedAt || a?.timestamp || null,
      totalMessages: Array.isArray(a?.messages) ? a.messages.length : null,
    }));
    console.info('[FinalResult][selected archives]', { roomId: baseId, desiredVideoId, count: debugList.length, list: debugList });
  } catch (e) {
    console.warn('[FinalResult][debug log failed]', e?.message);
  }

  if (!archives.length){
    const empty = {
      createdAt: new Date().toISOString(),
      sections: {
        overall: { rank: null, score: null, totalMessages: 0, totalReactions: 0 },
        aiSummary: null,
        personaIntegrated: { counts: { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 }, percentages: { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 } },
        personaByRound: [],
        participationByRound: [],
        top3Statements: [],
        video: (typeof desiredVideoId !== 'undefined') ? desiredVideoId : undefined
      }
    };
    finalResultCache.set(key, empty);
    return { roomId: baseId, nickname, cached:false, ...empty };
  }

  // 2) Aggregate across selected archives (by video)
  const perUser = {};
  const personaByRound = []; // [{ round_number, labels:{...} }]
  const participationByRound = []; // [{ round_number, totalMessages, totalReactions, myMessages, myReactions }]
  const allMessages = [];
  const integratedLabels = { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 };
  // mine: integrated and per round
  const integratedLabelsMine = { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 };
  const personaByRoundMine = []; // [{ round_number, labels:{...} }]

  for (const a of archives){
    const rno = (typeof a.round_number === 'number') ? a.round_number : undefined;
    const labelsAgg = { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 };
    const msgs = Array.isArray(a.messages) ? a.messages : [];
    let totalReactions = 0, myMsgs = 0, myReacts = 0;

    // per-user merge + per-round aggregates
    for (const [nick, u] of Object.entries(a.perUser || {})){
      if (!perUser[nick]) perUser[nick] = { nickname:nick, totalMessages:0, totalReactions:0, labels:{ '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 } };
      perUser[nick].totalMessages += (u.totalMessages||0);
      perUser[nick].totalReactions += (u.totalReactions||0);
      for (const k of Object.keys(perUser[nick].labels)){
        const v = u.labels?.[k]||0;
        perUser[nick].labels[k] += v;
        labelsAgg[k] += v;
        integratedLabels[k] += v;
      }
    }

    // my labels for this archive (round/video)
    const myAgg = (a.perUser && nickname && a.perUser[nickname]) ? a.perUser[nickname] : null;
    const myLabelsThis = myAgg?.labels || { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 };
    for (const k of Object.keys(integratedLabelsMine)) integratedLabelsMine[k] += (myLabelsThis[k] || 0);

    for (const m of msgs){
      totalReactions += (m.reactionsCount||0);
      if ((nickname||'') && m.nickname === nickname){
        myMsgs += 1; myReacts += (m.reactionsCount||0);
      }
      // for AI only my messages (we'll filter below)
      allMessages.push(m);
    }

    personaByRound.push({ round_number: rno, labels: labelsAgg });
    participationByRound.push({ round_number: rno, totalMessages: msgs.length, totalReactions: totalReactions, myMessages: myMsgs, myReactions: myReacts });
    personaByRoundMine.push({ round_number: rno, labels: { ...myLabelsThis } });
  }

  // 3) Ranking recompute (overall)
  const calcScore = (u) => (u.totalReactions||0)*3 + (Object.values(u.labels||{}).reduce((a,b)=>a+(b||0),0))*1 + (u.totalMessages||0)*0.5;
  const ranking = Object.values(perUser).map(u=>({ nickname:u.nickname, totalMessages:u.totalMessages, totalReactions:u.totalReactions, labels:u.labels, score:calcScore(u) }))
    .sort((a,b)=> b.score-a.score);
  let rank=1,last=null,same=0; for (const r of ranking){ if(last===null){rank=1;same=1;last=r.score;} else if(r.score===last){same++;} else {rank+=same;same=1;last=r.score;} r.rank=rank; }
  const meRow = ranking.find(x=>x.nickname===nickname);
  const overall = {
    rank: meRow?.rank ?? null,
    score: meRow?.score ?? null,
    totalMessages: perUser[nickname]?.totalMessages || 0,
    totalReactions: perUser[nickname]?.totalReactions || 0,
  };

  // 4) Persona integrated percentages
  const totalLabelSum = Object.values(integratedLabels).reduce((a,b)=>a+(b||0),0) || 1;
  const personaIntegrated = {
    counts: integratedLabels,
    percentages: Object.fromEntries(Object.entries(integratedLabels).map(([k,v])=>[k, Math.round((v/totalLabelSum)*1000)/10])) // 0.1% 단위 반올림
  };
  const totalLabelSumMine = Object.values(integratedLabelsMine).reduce((a,b)=>a+(b||0),0) || 1;
  const personaIntegratedMine = {
    counts: integratedLabelsMine,
    percentages: Object.fromEntries(Object.entries(integratedLabelsMine).map(([k,v])=>[k, Math.round((v/totalLabelSumMine)*1000)/10]))
  };

  // 5) AI summary with only my messages (skippable)
  let aiSummary = null;
  const skipAISummary = !!opts.skipAISummary;
  try {
    if (!skipAISummary) {
      const myMsgs = allMessages.filter(m => (nickname||'') && m.nickname === nickname).map(m => ({ text: m.text || '' }));
      if (myMsgs.length){
        const url = `${AI_BASE.replace(/\/$/, '')}/evaluate`;
        const payload = { user_id: nickname || 'me', user_messages: myMsgs, discussion_context:{} };
        const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
        if (res.ok){ const data = await res.json().catch(()=>({})); aiSummary = data?.personalized_feedback || data?.result || data?.text || null; }
        console.log("aiSummary:",aiSummary);
      }
    }
  } catch {}

  // 6) Top3 statements: only my statements (highest reactions)
  const top3Base = allMessages
    .filter(m => (m?.text||'').trim().length > 0 && (!!nickname && m.nickname === nickname));
  const top3Statements = top3Base
    .sort((a,b)=> (b.reactionsCount||0) - (a.reactionsCount||0))
    .slice(0,3)
    .map(m => ({
      text: m.text,
      reactionsCount: m.reactionsCount || 0,
      createdAt: m.createdAt,
      round_number: m.round_number
    }));

  // 7) Build final sections object tailored for FinalResultPage
  const selectedVideoId = (typeof desiredVideoId !== 'undefined') ? desiredVideoId : (archives[0]?.video_id_key ?? archives[0]?.video_id_index);
  const sections = {
    video: selectedVideoId,
    overall,
    aiSummary,
    personaIntegrated,
    personaIntegratedMine,
    personaByRound,
    personaByRoundMine,
    participationByRound,
    top3Statements,
    ranking // keep full ranking for other widgets if needed
  };

  const result = { createdAt: new Date().toISOString(), sections };
  finalResultCache.set(key, result);
  return { roomId: baseId, nickname, cached:false, ...result };
}

export function getFinalResult(roomId, nickname){
  if (!roomId) throw new Error('roomId_required');
  const baseId = toBaseRoomId(roomId);
  const key = `${baseId}|${nickname||''}`;
  const v = finalResultCache.get(key);
  return v ? { roomId: baseId, nickname, ...v } : null;
}

export function getOverallSummary(roomId) {
  if (!roomId) throw new Error('roomId_required');
  const v = overallSummaryCache.get(roomId);
  return v ? { roomId, ...v } : null;
}

export async function generateOverallSummary(roomId, opts = {}) {
  const force = !!opts.force;
  if (!roomId) throw new Error('roomId_required');

  if (!force && overallSummaryCache.has(roomId)) {
    const cached = overallSummaryCache.get(roomId);
    return { roomId, cached: true, ...cached };
  }

  const snap = getRoomSnapshot(roomId);

  // Prefer in-memory snapshot; if empty (e.g., room already cleaned up), fall back to latest archive
  let messages = Array.isArray(snap?.messages) ? snap.messages : [];
  let topic = snap?.context?.topic || '';
  let duration = snap?.context?.duration;
  let round_number = snap?.context?.round_number;

  if (!messages.length) {
    try {
      const baseId = toBaseRoomId(roomId);
      const archives = await listRoomArchives(baseId);
      const timeOf = (a) => {
        const t = a?.archivedAt || a?.createdAt || a?.updatedAt || a?.endedAt || a?.timestamp;
        const n = t ? Date.parse(t) : NaN;
        return Number.isFinite(n) ? n : (typeof t === 'number' ? t : 0);
      };
      const latest = (archives || []).sort((x, y) => timeOf(y) - timeOf(x))[0];
      if (latest) {
        // Build messages in the same shape as getRoomSnapshot
        const msgs = Array.isArray(latest.messages) ? latest.messages : [];
        messages = msgs.map(m => ({
          nickname: m.nickname || m.user_id || '익명',
          text: (m.text || m.message || '').toString(),
          createdAt: m.createdAt || m.timestamp || null
        })).filter(m => (m.text || '').trim().length > 0);

        // Fill discussion context from archive if missing
        if (!topic && latest.topic) topic = latest.topic;
        if (typeof duration === 'undefined') {
          const cAt = typeof latest.createdAt === 'number' ? latest.createdAt : (latest.createdAt ? Date.parse(latest.createdAt) : NaN);
          const eAt = typeof latest.expireAt === 'number' ? latest.expireAt : (latest.expireAt ? Date.parse(latest.expireAt) : NaN);
          const minutes = (Number.isFinite(cAt) && Number.isFinite(eAt)) ? Math.round((eAt - cAt) / 60000) : undefined;
          if (Number.isFinite(minutes)) duration = minutes;
        }
        if (typeof round_number === 'undefined' && typeof latest.round_number !== 'undefined') {
          round_number = latest.round_number;
        }
      }
    } catch {
      // ignore archive fallback errors and proceed with empty payload
    }
  }


  const all_user_messages = messages.map(m => ({ user_id: m.nickname || m.userId || '익명', text: m.text || m.message || '' }));
  const discussion_context = {};
  if (topic) discussion_context.topic = topic;
  if (typeof duration !== 'undefined') discussion_context.duration = duration;
  if (typeof round_number !== 'undefined') discussion_context.round_number = round_number;

  const payload = { user_id: 'system', all_user_messages, discussion_context };
  console.log(payload);
  const url = `${AI_BASE.replace(/\/$/, '')}/discussion-overall`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {

    const body = await res.text().catch(() => '');
    const err = new Error(`ai_request_failed: ${res.status}`);
    err.details = body;
    throw err;
  }
  const data = await res.json().catch(() => ({}));

  // AI 서버가 { summary: "..."} 형태를 준다고 가정, 없으면 백업
  const summaryText = data?.discussion_summary || data?.summary || data?.result || data?.text || JSON.stringify(data);
  const result = { summaryText, createdAt: new Date().toISOString(), payload };
  overallSummaryCache.set(roomId, result);
  return { roomId, cached: false, ...result };
}

// Aggregate across multiple videoIds
export async function generateMultiVideoFinalResult(roomId, nickname, videoIds = [], opts = {}) {
  if (!Array.isArray(videoIds) || !videoIds.length)
    throw new Error('videoIds_required');
  try { console.info('[MultiFinalResult][request]', { roomId, nickname, videoIds }); } catch {}

    const baseId = toBaseRoomId(roomId);
    const sortedKey = videoIds.map(v => String(v)).sort().join(',');
    const key = `${baseId}|${nickname||''}|mvid=${sortedKey}`;
    const force = !!opts.force;
    if (!force && multiFinalResultCache.has(key)) {
      const cached = multiFinalResultCache.get(key);
      return { roomId: baseId, nickname, cached: true, ...cached };
    }

  const allResults = [];
  for (const vid of videoIds) {
    const r = await generateFinalResult(roomId, nickname, { videoId: vid, skipAISummary: true });
    if (r && r.sections) allResults.push(r.sections);
  }

  // Collect my messages across the latest archives of requested videos for a single AI summary call
  let aiSummary = null;
  try {
    const archives = await listRoomArchives(toBaseRoomId(roomId));
    const timeOf = (a) => {
      const t = a?.archivedAt || a?.createdAt || a?.updatedAt || a?.endedAt || a?.timestamp;
      const n = t ? Date.parse(t) : NaN;
      return Number.isFinite(n) ? n : 0;
    };
    // keep only with video identity
    const valid = (archives||[]).filter(a => typeof a?.video_id_index !== 'undefined' || typeof a?.video_id_key !== 'undefined');
    // latest by video for requested list
    const latestByVideo = {};
    for (const a of valid) {
      const vid = (typeof a.video_id_index !== 'undefined') ? a.video_id_index : a.video_id_key;
      if (!videoIds.some(v => String(v) === String(vid))) continue;
      if (!latestByVideo[vid] || timeOf(a) > timeOf(latestByVideo[vid])) latestByVideo[vid] = a;
    }
    // gather my messages
    const myMsgs = Object.values(latestByVideo)
      .flatMap(a => Array.isArray(a?.messages) ? a.messages : [])
      .filter(m => (nickname||'') && m.nickname === nickname && (m?.text||'').trim().length > 0)
      .map(m => ({ text: m.text || '' }));
    if (myMsgs.length) {
      const url = `${AI_BASE.replace(/\/$/, '')}/evaluate`;
      const payload = { user_id: nickname || 'me', user_messages: myMsgs, discussion_context:{} };
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (res.ok){ const data = await res.json().catch(()=>({})); aiSummary = data?.personalized_feedback || data?.result || data?.text || null; }
      console.info('[MultiFinalResult][aiSummary] requested once for all videos', { countMessages: myMsgs.length });
    }
  } catch (e) {
    console.warn('[MultiFinalResult][aiSummary] failed', e?.message);
  }

  if (!allResults.length) {
    const empty = {
      roomId:baseId,
      nickname,
      createdAt: new Date().toISOString(),
      sections: {
        overall: { rank: null, score: null, totalMessages: 0, totalReactions: 0 },
        aiSummary: null,
        personaIntegrated: { counts: { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 }, percentages: { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 } },
        personaByVideo: [],
        participationByVideo: [],
        ranking: [],
      }
    };
      multiFinalResultCache.set(key, empty);
      return { cached: false, ...empty };
  }

  const mergedLabels = { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 };
  const mergedRanking = {};
  const participationByVideo = [];
  const personaByVideo = [];
  // mine
  const personaByVideoMine = [];
  const mergedLabelsMine = { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 };

  let totalMessages = 0;
  let totalReactions = 0;

  for (const sec of allResults) {
    totalMessages += sec.overall?.totalMessages || 0;
    totalReactions += sec.overall?.totalReactions || 0;

    for (const k of Object.keys(mergedLabels)) {
      mergedLabels[k] += sec.personaIntegrated?.counts?.[k] || 0;
    }

    personaByVideo.push({ video: sec.video, labels: { ...sec.personaIntegrated?.counts } });
    participationByVideo.push({
      video: sec.video,
      totalMessages: sec.overall?.totalMessages || 0,
      totalReactions: sec.overall?.totalReactions || 0,
      score: sec.overall?.score || 0,
    });

    // mine per video from per-result ranking
    const meRowSec = (sec.ranking || []).find(x => x.nickname === nickname);
    if (meRowSec && meRowSec.labels){
      for (const k of Object.keys(mergedLabelsMine)) mergedLabelsMine[k] += (meRowSec.labels[k] || 0);
      personaByVideoMine.push({ video: sec.video, labels: { ...meRowSec.labels } });
    } else {
      personaByVideoMine.push({ video: sec.video, labels: { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 } });
    }

    for (const r of (sec.ranking || [])) {
      if (!mergedRanking[r.nickname])
        mergedRanking[r.nickname] = { nickname: r.nickname, totalMessages: 0, totalReactions: 0, labels: { '금융이해':0,'계획성':0,'실천의지':0,'위험인식':0 } };
      mergedRanking[r.nickname].totalMessages += r.totalMessages || 0;
      mergedRanking[r.nickname].totalReactions += r.totalReactions || 0;
      for (const k of Object.keys(mergedLabels)) {
        mergedRanking[r.nickname].labels[k] += (r.labels?.[k] || 0);
      }
    }
  }

  const calcScore = (u) => (u.totalReactions||0) * 3 +
    Object.values(u.labels||{}).reduce((a,b)=>a+(b||0),0) +
    (u.totalMessages||0) * 0.5;

  const ranking = Object.values(mergedRanking)
    .map(u => ({ ...u, score: calcScore(u) }))
    .sort((a,b)=> b.score - a.score);

  let rank = 1, same = 0, last = null;
  for (const r of ranking) {
    if (last === null) { rank = 1; same = 1; last = r.score; }
    else if (r.score === last) same++;
    else { rank += same; same = 1; last = r.score; }
    r.rank = rank;
  }

  const me = ranking.find(r => r.nickname === nickname);

  const totalLabelSum = Object.values(mergedLabels).reduce((a,b)=>a+(b||0),0) || 1;
  const personaIntegrated = {
    counts: mergedLabels,
    percentages: Object.fromEntries(Object.entries(mergedLabels).map(([k,v])=>[k, Math.round((v/totalLabelSum)*1000)/10]))
  };
  const totalLabelSumMine2 = Object.values(mergedLabelsMine).reduce((a,b)=>a+(b||0),0) || 1;
  const personaIntegratedMine = {
    counts: mergedLabelsMine,
    percentages: Object.fromEntries(Object.entries(mergedLabelsMine).map(([k,v])=>[k, Math.round((v/totalLabelSumMine2)*1000)/10]))
  };
  const personaByRoundMine = Array.isArray(personaByVideoMine)
    ? personaByVideoMine.map((v, idx) => ({ round_number: Number.isInteger(Number(v.video)) ? Number(v.video) + 1 : idx + 1, labels: { ...(v.labels || {}) } }))
    : [];

  const overall = {
    rank: me?.rank ?? null,
    score: me?.score ?? null,
    totalMessages,
    totalReactions,
  };

  // Derive round-shaped arrays from video-based arrays (to avoid client-side mock fallbacks)
  const personaByRound = Array.isArray(personaByVideo) ? personaByVideo.map((v, idx) => ({
    round_number: Number.isInteger(Number(v.video)) ? Number(v.video) + 1 : idx + 1,
    labels: { ...(v.labels || {}) },
  })) : [];

  const participationByRound = Array.isArray(participationByVideo) ? participationByVideo.map((v, idx) => ({
    round_number: Number.isInteger(Number(v.video)) ? Number(v.video) + 1 : idx + 1,
    totalMessages: Number(v.totalMessages || 0),
    totalReactions: Number(v.totalReactions || 0),
    myMessages: Number(v.myMessages || 0),
    myReactions: Number(v.myReactions || 0),
  })) : [];

  // Build Top3 statements across latest archives of the requested videos (only my messages)
  let top3Statements = [];
  try {
    const archives2 = await listRoomArchives(toBaseRoomId(roomId));
    const timeOf2 = (a) => {
      const t = a?.archivedAt || a?.createdAt || a?.updatedAt || a?.endedAt || a?.timestamp;
      const n = t ? Date.parse(t) : NaN;
      return Number.isFinite(n) ? n : 0;
    };
    const valid2 = (archives2||[]).filter(a => typeof a?.video_id_index !== 'undefined' || typeof a?.video_id_key !== 'undefined');
    const latestByVideo2 = {};
    for (const a of valid2) {
      const vid = (typeof a.video_id_index !== 'undefined') ? a.video_id_index : a.video_id_key;
      if (!videoIds.some(v => String(v) === String(vid))) continue;
      if (!latestByVideo2[vid] || timeOf2(a) > timeOf2(latestByVideo2[vid])) latestByVideo2[vid] = a;
    }
    const myMsgs2 = Object.values(latestByVideo2)
      .flatMap(a => Array.isArray(a?.messages) ? a.messages : [])
      .filter(m => (nickname||'') && m.nickname === nickname && (m?.text||'').trim().length > 0);
    top3Statements = myMsgs2
      .sort((a,b)=> (b.reactionsCount||0) - (a.reactionsCount||0))
      .slice(0,3)
      .map(m => ({ text: m.text, reactionsCount: m.reactionsCount || 0, createdAt: m.createdAt, round_number: m.round_number }));
  } catch {}

  const result = {
    roomId: baseId,
    nickname,
    createdAt: new Date().toISOString(),
    sections: {
      overall,
      aiSummary,
      personaIntegrated :personaIntegratedMine ,
      personaByVideo,
      participationByVideo,
      // derived for clients expecting round-based keys
      personaByRound :personaByRoundMine ,
      participationByRound,
      top3Statements,
      ranking,
    }
  };
  multiFinalResultCache.set(key, result);
  return { cached: false, ...result };
}