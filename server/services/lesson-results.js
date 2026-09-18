import {activities} from '../data/course-content.js';
const axes=['금융이해','위험인식','계획성','실천의지'];
const statusOf=values=>values.includes('pending')?'pending':values.some(v=>['partial','error','failed','unavailable'].includes(v))?'partial':values.every(v=>v==='empty')?'empty':'ready';

export function mergeLessonResults(results, round) {
  const present=results.filter(Boolean);
  const perUser={};
  for(const result of present) for(const [nickname,row] of Object.entries(result.perUser||{})) {
    const merged=perUser[nickname] ||= {nickname,totalMessages:0,totalReactions:0,labels:Object.fromEntries(axes.map(a=>[a,0]))};
    merged.totalMessages+=row.totalMessages||0;merged.totalReactions+=row.totalReactions||0;
    for(const axis of axes) merged.labels[axis]+=row.labels?.[axis]||0;
    if(row.topReacted && (!merged.topReacted || row.topReacted.reactionsCount>merged.topReacted.reactionsCount)) merged.topReacted=row.topReacted;
  }
  const ranking=Object.values(perUser).map(row=>({...row,score:row.totalMessages*.5+row.totalReactions*3+Object.values(row.labels).reduce((a,b)=>a+b,0)})).sort((a,b)=>b.score-a.score);
  ranking.forEach((row,index)=>row.rank=index && row.score===ranking[index-1].score?ranking[index-1].rank:index+1);
  const missing=present.length<results.length;
  const states=field=>results.map(r=>r ? r[field]?.status||'ready':'pending');
  return {round_number:round,createdAt:Math.max(0,...present.map(r=>r.createdAt||0)),perUser,ranking,
    avatarMap:Object.assign({},...present.map(r=>r.avatarMap||{})),
    classification:{status:statusOf(states('classification')),pending:present.reduce((n,r)=>n+(r.classification?.pending||0),0),failed:present.reduce((n,r)=>n+(r.classification?.failed||0),0)},
    topicSummaries:{status:statusOf(states('topicSummaries')),topics:present.flatMap(r=>r.topicSummaries?.topics||[]),completed:present.reduce((n,r)=>n+(r.topicSummaries?.completed||0),0),total:present.reduce((n,r)=>n+(r.topicSummaries?.total||0),0)},
    overallSummary:present.map(r=>r.overallSummary).filter(Boolean).join('\n\n'),
    overallSummaryStatus:missing?'pending':statusOf(present.map(r=>r.overallSummaryStatus||'pending')),
    persistenceStatus:present.some(r=>r.persistenceStatus==='error')?'error':'ready',
  };
}

export function groupVideoRows(rows, kind) {
  const grouped=new Map();
  for(const value of rows) {
    const round=activities.find(a=>a.videoId===Number(value.video))?.lessonId;
    if(!round) continue;
    const row=grouped.get(round)||{round_number:round,...(kind==='labels'?{labels:{}}:{totalMessages:0,totalReactions:0,myMessages:0,myReactions:0})};
    if(kind==='labels') for(const [axis,count] of Object.entries(value.labels||{})) row.labels[axis]=(row.labels[axis]||0)+Number(count||0);
    else for(const field of ['totalMessages','totalReactions','myMessages','myReactions']) row[field]+=Number(value[field]||0);
    grouped.set(round,row);
  }
  return [...grouped.values()].sort((a,b)=>a.round_number-b.round_number);
}
