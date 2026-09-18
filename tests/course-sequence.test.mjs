import test from 'node:test';
import assert from 'node:assert/strict';
import * as course from '../src/contents/financial-course.js';

test('four lessons map to zero, one, two and one activities without changing video identities',()=>{
 assert.deepEqual(course.lessons.map(l=>l.activityIds),[[],[0],[1,3],[2]]);
 assert.deepEqual(course.activities.map(a=>[a.videoId,a.lessonId,a.sourceScenarioId]),[[0,2,2],[1,3,3],[2,4,4],[3,3,5]]);
});
test('quiz one leads to lesson two and insurance leads to retirement before its dashboard',()=>{
 assert.deepEqual(course.afterQuiz(1),{round:2,step:1,videoId:0,path:'slide',label:'2차시 이론'});
 assert.deepEqual(course.afterDiscussion(3,1),{round:3,step:3,videoId:3,path:'video',label:'노후 생활비와 준비'});
 assert.equal(course.afterDiscussion(3,3).path,'discussionResult');
 assert.equal(course.afterDiscussion(4,2).path,'discussionResult');
 assert.deepEqual(course.lessonSteps(1).map(s=>s.step),[1,2]);
});
test('saved retirement progress stays in lesson three and cannot become lesson four',()=>{
 assert.equal(course.restoreProgress(JSON.stringify({round:3,videoId:3,step:4})).videoId,3);
 assert.equal(course.restoreProgress(JSON.stringify({round:4,videoId:3,step:3})).videoId,2);
 assert.equal(course.nextLesson(2).videoId,1);
 assert.equal(course.nextLesson(3).videoId,2);
});
test('reconnected slides catch up, but old slides never rewind a started quiz',()=>{
 const slide={commandId:'s',round:3,step:1,page:49};
 assert.equal(course.syncTarget(slide,{round:3,step:1},false).path,'slide');
 assert.equal(course.syncTarget(slide,{round:3,step:3},true),null);
 assert.equal(course.syncTarget(slide,{round:4,step:1},false),null);
 assert.equal(course.syncTarget({...slide,page:59},{round:3,step:1},true),null);
 assert.equal(course.syncTarget(slide,{round:2,step:5},true).path,'slide');
});
