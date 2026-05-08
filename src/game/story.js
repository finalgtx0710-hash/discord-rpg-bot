export const STORY_CHAPTERS = {
  chapter1: {
    id: 'chapter1', title: '第一章：旅立ち',
    description: 'エーテル結晶が各地で消え始めた。あなたは冒険者として立ち上がることを決意した。',
    unlock_condition: { type: 'start', value: 0 },
    scenes: [
      { id: 's1_1', text: '村長：「冒険者よ、聞いてくれ。村の近くにあったエーテル結晶が突然消えてしまったんだ。魔物も増えているし、このままでは村が危ない。」' },
      { id: 's1_2', text: '村長：「ゴブリンどもが村の周辺に現れるようになった。まずは周辺を探索して、状況を確認してほしい。」' },
      { id: 's1_3', text: 'あなたは村長の依頼を受け、エーテル結晶の謎を解くべく冒険を始めることにした。' },
    ],
    reward: { exp: 100, gold: 200 },
  },
  chapter2: {
    id: 'chapter2', title: '第二章：囁きの森へ',
    description: '結晶消失の手がかりが囁きの森にあることを知る。',
    unlock_condition: { type: 'quests_completed', value: 2 },
    scenes: [
      { id: 's2_1', text: '旅の賢者：「エーテル結晶の消失は、古代の封印が解けかけているサインかもしれない。囁きの森の奥に手がかりがあるはずだ。」' },
      { id: 's2_2', text: '旅の賢者：「森には強力な魔物が棲んでいる。十分に力をつけてから向かうのだ。そして…森の守護者に気をつけろ。」' },
      { id: 's2_3', text: 'あなたは囁きの森へと足を踏み入れた。不思議な声が聞こえる気がした。' },
    ],
    reward: { exp: 300, gold: 500 },
  },
  chapter3: {
    id: 'chapter3', title: '第三章：古代の真実',
    description: '古代遺跡にたどり着いたあなたは、想像を絶する秘密を知る。',
    unlock_condition: { type: 'quests_completed', value: 5 },
    scenes: [
      { id: 's3_1', text: '石板の刻印：「我々は古代の覇王を封印するため、エーテル結晶を要石として使った。しかし封印は永遠ではない…」' },
      { id: 's3_2', text: '謎の声：「よくここまで来た、冒険者よ。エーテル結晶が消えているのは、封印が解けつつある証拠だ。覇王が復活すれば世界は終わる。」' },
      { id: 's3_3', text: 'あなたは真実を知った。エーテル結晶消失の黒幕は古代の覇王。その封印を取り戻すため、あなたは最後の戦いへと向かう。' },
    ],
    reward: { exp: 600, gold: 1000 },
  },
  chapter4: {
    id: 'chapter4', title: '終章：覇王の封印',
    description: '古代の覇王との最終決戦。世界の命運はあなたの手に。',
    unlock_condition: { type: 'boss_defeated', value: 'forest_guardian' },
    scenes: [
      { id: 's4_1', text: '古代の覇王：「封印が解けた今、もはや何者も我を止められぬ。エーテリオンは我が支配下に置かれる！」' },
      { id: 's4_2', text: 'あなた：「ここで終わりにする。世界はお前のものじゃない！」' },
      { id: 's4_3', text: '長い戦いの末、あなたは古代の覇王を打ち倒した。エーテル結晶の光が世界中に戻り始め、人々の笑顔が戻ってきた。\n\nエーテリオン・クロニクル、完。' },
    ],
    reward: { exp: 2000, gold: 5000 },
  },
};

export function getUnlockedChapters(player) {
  const completedQuests = (player.quests?.completed || []).length;
  const defeatedBosses = player.story?.defeated_bosses || [];
  return Object.values(STORY_CHAPTERS).filter(ch => {
    const cond = ch.unlock_condition;
    if (cond.type === 'start') return true;
    if (cond.type === 'quests_completed') return completedQuests >= cond.value;
    if (cond.type === 'boss_defeated') return defeatedBosses.includes(cond.value);
    return false;
  });
}

export function getNextScene(player, chapterId) {
  const chapter = STORY_CHAPTERS[chapterId];
  if (!chapter) return null;
  const viewedScenes = player.story?.viewed_scenes || [];
  return chapter.scenes.find(s => !viewedScenes.includes(s.id)) || null;
}