import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessons,activities} from '../src/contents/financial-course.js';

test('every video exposes answerable prompts, not only topic headings', () => {
  const master=JSON.parse(readFileSync(new URL('../server/data/discussion_questions/default.json',import.meta.url)));
  for(const lesson of activities){
    assert.equal(lesson.topics.length,3);
    assert.equal(master.video_content[lesson.videoKey].lesson_id,lesson.lessonId);
    for(const question of lesson.topics){
      assert.ok(question.length>25, `Only a heading is shown: ${question}`);
      assert.match(question, /[?？]|주세요[.!]?$/);
    }
    assert.deepEqual(master.video_content[lesson.videoKey].discussion_questions,lesson.topics);
  }
});

test('the last lesson includes the checklist, contact information and closing slide',()=>{
  assert.deepEqual(lessons[3].theoryPages.slice(-3),[61,62,63]);
});
