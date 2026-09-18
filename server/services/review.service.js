import {groupVideoRows} from './lesson-results.js';
// server/services/review.service.js
import { getRoomSnapshot } from './socket.service.js';
import { listRoomArchives } from './socket.service.js';
import {startSummary, summaryKey, fetchAIJson} from './summary-jobs.js';

const AI_BASE = process.env.AI_SERVER_BASE || process.env.AI_BASE || 'http://localhost:8000';

// in-memory cache: roomId -> { summaryText, createdAt, payload }
const overallSummaryCache = new Map();
// in-memory cache: `${baseRoomId}|${nickname}` -> final result blob
const finalResultCache = new Map();
// in-memory cache: `${baseRoomId}|${nickname}|mvid=sortedIds` -> multi video final result blob
function archiveTime(a) {
  const t = a?.archivedAt || a?.createdAt || a?.updatedAt || a?.endedAt || a?.timestamp;
  const n = typeof t === 'number' ? t : Date.parse(t);
  return Number.isFinite(n) ? n : 0;
}
function latestArchives(archives, videoIds) {
  const latest = new Map();
  for (const a of archives) {
    const video = a.video_id_index ?? a.video_id_key;
    if (video == null || (videoIds && !videoIds.some(v => String(v) === String(video)))) continue;
    const previous = latest.get(String(video));
    if (!previous || archiveTime(a) > archiveTime(previous)) latest.set(String(video), a);
  }
  return [...latest.values()];
}
function classificationProgress(archives) {
  let pending = 0, failed = 0;
  for (const a of archives) {
    if (a.classification) {
      pending += Number(a.classification.pending) || 0;
      failed += Number(a.classification.failed) || 0;
    } else for (const m of a.messages || []) {
      if (m.ai?.state === 'PENDING') pending++;
      if (m.ai?.state === 'ERROR') failed++;
    }
  }
  return {status:pending ? 'pending' : failed ? 'partial' : 'ready', pending, failed};
}
async function personalSummary(scope, nickname, messages, opts) {
  if (!messages.length) return {aiSummary:null, aiSummaryStatus:'empty'};
  const payload = {user_id:nickname || 'me', user_messages:messages, discussion_context:{}};
  const job = startSummary(summaryKey(scope, payload), async () => {
    const data = await fetchAIJson(`${AI_BASE.replace(/\/$/, '')}/evaluate`, payload);
    const value = data?.personalized_feedback || data?.result || data?.text;
    if (typeof value !== 'string' || !value.trim()) throw new Error('Empty personal summary');
    return value;
  }, {force:opts.force, retry:opts.retryAI});
  if (!opts.deferAI) await job.promise;
  return {aiSummary:job.value, aiSummaryStatus:job.status};
}

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
  let archives = opts.archives || await listRoomArchives(baseId);

  // ---- Video-scoped archive selection (latest per video) ----
  const timeOf = archiveTime;

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

  const summary = opts.skipAISummary ? {aiSummary:null, aiSummaryStatus:'empty'} : await personalSummary(
    [baseId, vidKey], nickname,
    allMessages.filter(m => nickname && m.nickname === nickname).map(m => ({text:m.text || ''})), opts);

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
    ...summary,
    classification:classificationProgress(archives),
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

  const snap = getRoomSnapshot(roomId);

  // Prefer in-memory snapshot; if empty (e.g., room already cleaned up), fall back to latest archive
  let messages = Array.isArray(snap?.messages) ? snap.messages : [];
  let topic = snap?.context?.topic || '';
  let duration = snap?.context?.duration;
  let round_number = snap?.context?.round_number;

  if (!messages.length) {
    try {
      const archives = await listRoomArchives(roomId);
      const timeOf = archiveTime;
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
  if (!all_user_messages.length) return {roomId, summaryText:null, status:'empty'};
  const job = startSummary(summaryKey(['overall', roomId], payload), async () => {
    const data = await fetchAIJson(`${AI_BASE.replace(/\/$/, '')}/discussion-overall`, payload);
    const summaryText = data?.discussion_summary || data?.summary || data?.result || data?.text;
    if (typeof summaryText !== 'string' || !summaryText.trim()) throw new Error('Empty room summary');
    return summaryText;
  }, {force});
  if (!opts.deferAI) await job.promise;
  const result = {roomId, summaryText:job.value, status:job.status, createdAt:new Date().toISOString()};
  overallSummaryCache.set(roomId, result);
  job.promise.then(() => {
    result.summaryText = job.value;
    result.status = job.status;
  });
  return result;
}

// Aggregate across multiple videoIds
export async function generateMultiVideoFinalResult(roomId, nickname, videoIds = [], opts = {}) {
  if (!Array.isArray(videoIds) || !videoIds.length)
    throw new Error('videoIds_required');
  const baseId = toBaseRoomId(roomId);
  const archives = latestArchives(await listRoomArchives(baseId), videoIds);
  const allResults = await Promise.all(videoIds.map(async videoId => {
    const result = await generateFinalResult(roomId, nickname, {videoId, skipAISummary:true, archives});
    return result.sections;
  }));
  const myMessages = archives.flatMap(a => a.messages || [])
    .filter(m => nickname && m.nickname === nickname && (m.text || '').trim());
  const summary = await personalSummary([baseId, videoIds.map(String).sort()], nickname,
    myMessages.map(m => ({text:m.text})), opts);

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
      myMessages: (sec.ranking||[]).find(r=>r.nickname===nickname)?.totalMessages||0,
      myReactions: (sec.ranking||[]).find(r=>r.nickname===nickname)?.totalReactions||0,
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
  const personaByRoundMine = groupVideoRows(personaByVideoMine,'labels');

  const overall = {
    rank: me?.rank ?? null,
    score: me?.score ?? null,
    totalMessages,
    totalReactions,
  };

  const participationByRound = groupVideoRows(participationByVideo,'participation');

  const top3Statements = [...myMessages]
    .sort((a,b) => (b.reactionsCount || 0) - (a.reactionsCount || 0)).slice(0,3)
    .map(m => ({text:m.text, reactionsCount:m.reactionsCount || 0, createdAt:m.createdAt, round_number:m.round_number}));

  const result = {
    roomId: baseId,
    nickname,
    createdAt: new Date().toISOString(),
    sections: {
      overall,
      ...summary,
      classification:classificationProgress(archives),
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
  return { cached: false, ...result };
}