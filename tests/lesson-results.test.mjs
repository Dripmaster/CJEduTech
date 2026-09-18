import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLessonResults, groupVideoRows} from '../server/services/lesson-results.js';
const source=(name,messages,labels,status='ready')=>({createdAt:1,perUser:{student:{nickname:'student',totalMessages:messages,totalReactions:1,labels:{계획성:labels}}},avatarMap:{student:'2'},classification:{status,pending:status==='pending'?1:0,failed:0},topicSummaries:{status:'ready',topics:[{topic:name,summaries:[]}],completed:1,total:1},overallSummary:name,overallSummaryStatus:'ready'});
test('insurance and retirement are summed once in lesson three, including delayed results',()=>{
 const result=mergeLessonResults([source('보험',2,1),source('노후',3,2,'pending')],3);
 assert.equal(result.perUser.student.totalMessages,5);
 assert.equal(result.perUser.student.labels.계획성,3);
 assert.equal(result.ranking[0].score,11.5);
 assert.equal(result.classification.status,'pending');
 assert.equal(result.topicSummaries.topics.length,2);
 assert.match(result.overallSummary,/보험/);assert.match(result.overallSummary,/노후/);
});
test('final charts aggregate both lesson-three videos without fabricating lesson-one discussion',()=>{
 assert.deepEqual(groupVideoRows([{video:0,totalMessages:1},{video:1,totalMessages:2},{video:3,totalMessages:3},{video:2,totalMessages:4}],'participation').map(r=>[r.round_number,r.totalMessages]),[[2,1],[3,5],[4,4]]);
 const rows=groupVideoRows([{video:1,labels:{계획성:2}},{video:3,labels:{계획성:3}}],'labels');
 assert.equal(rows[0].labels.계획성,5);
});
