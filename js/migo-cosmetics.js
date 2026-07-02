/**
 * ミ＝ゴキャッチャー景品マスタ（GAS / ゲーム / 住民台帳で共有）
 */
(function (global) {
  'use strict';

  const ITEMS = [
    { id: 'frame-fungal', emoji: '🍄', label: 'ユゴス菌糸', slot: 'frame', grabRate: 0.78 },
    { id: 'bg-nebula', emoji: '☄️', label: '隕石片', slot: 'bg', grabRate: 0.76 },
    { id: 'title-whisper', emoji: '📼', label: '禁断フィルム', slot: 'title', grabRate: 0.74, titleLabel: '囁きの観測者' },
    { id: 'frame-bone', emoji: '🦴', label: '地球製骨片', slot: 'frame', grabRate: 0.74 },
    { id: 'fx-glimpse', emoji: '👁', label: '第三の眼', slot: 'fx', grabRate: 0.72 },
    { id: 'bg-void', emoji: '🌑', label: '暗黒の欠片', slot: 'bg', grabRate: 0.70 },
    { id: 'frame-ether', emoji: '🛸', label: 'エーテル結晶', slot: 'frame', grabRate: 0.68 },
    { id: 'title-migo', emoji: '🔗', label: '鉤爪の欠片', slot: 'title', grabRate: 0.68, titleLabel: '菌類の取引人' },
    { id: 'frame-coral', emoji: '🦞', label: '薄桃甲殻', slot: 'frame', grabRate: 0.66 },
    { id: 'bg-mycelium', emoji: '🕸️', label: '菌糸床', slot: 'bg', grabRate: 0.66 },
    { id: 'title-deep', emoji: '🐙', label: '信徒の証', slot: 'title', grabRate: 0.64, titleLabel: '深きもの信者' },
    { id: 'frame-spore', emoji: '💫', label: '胞子リング', slot: 'frame', grabRate: 0.64 },
    { id: 'bg-plateau', emoji: '🏔️', label: '高原の霧', slot: 'bg', grabRate: 0.62 },
    { id: 'title-probe', emoji: '🧪', label: '観測標本', slot: 'title', grabRate: 0.60, titleLabel: '標本回収人' },
    { id: 'frame-rune', emoji: '🪬', label: '古神ルーン', slot: 'frame', grabRate: 0.58 },
    { id: 'bg-star', emoji: '🌌', label: '深空星図', slot: 'bg', grabRate: 0.58 },
    { id: 'title-dream', emoji: '💤', label: '白日の夢', slot: 'title', grabRate: 0.56, titleLabel: '夢渡りの観測者' },
    { id: 'fx-buzz', emoji: '📻', label: 'ブザー残響', slot: 'fx', grabRate: 0.56 },
    { id: 'fx-pollen', emoji: '🌸', label: '胞子舞い', slot: 'fx', grabRate: 0.54 },
    { id: 'fx-tentacle', emoji: '🦑', label: '触手の影', slot: 'fx', grabRate: 0.52 }
  ];

  const COMP = {
    id: 'frame-migo-wing',
    emoji: '🦇',
    label: 'ミ＝ゴの翼',
    slot: 'frame',
    titleLabel: null
  };

  const BASE_IDS = ITEMS.map(item => item.id);
  const SLOT = {};
  const LABELS = {};
  const META = {};
  const TITLE_LABELS = {};

  ITEMS.forEach(item => {
    SLOT[item.id] = item.slot;
    LABELS[item.id] = item.label;
    META[item.id] = { emoji: item.emoji, label: item.label, slot: slotJa(item.slot) };
    if (item.titleLabel) TITLE_LABELS[item.id] = item.titleLabel;
  });

  SLOT[COMP.id] = COMP.slot;
  LABELS[COMP.id] = COMP.label;
  META[COMP.id] = { emoji: COMP.emoji, label: COMP.label, slot: slotJa(COMP.slot) };

  const PRIZES = ITEMS.map(item => ({
    emoji: item.emoji,
    label: item.label,
    cosmeticId: item.id,
    grabRate: item.grabRate
  }));

  function slotJa(slot) {
    return { frame: '枠', bg: '背景', title: '称号', fx: '光' }[slot] || '';
  }

  global.MigoCosmetics = {
    BASE_IDS,
    BASE_COUNT: BASE_IDS.length,
    COMP_ID: COMP.id,
    PRIZES,
    LABELS,
    META,
    SLOT,
    TITLE_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
