import { chars } from '../util';

// Every shop sign in the Stack: real words, traditional and simplified (noodles, dentist, hotpot, tea, pharmacy, inn …).
export const WORDS = [
  '麵', '牙科', '火鍋', '茶', '藥房', '旅館', '麻雀', '九龍', '茶樓', '當舖', '押', '酒家', '金行', '眼科', '冰室', '雲吞', '燒臘', '涼茶',
  '士多', '理髮', '電器', '中醫', '跌打', '茶餐廳', '糖水', '粥麵', '串串香', '小面', '火锅', '药房', '旅馆', '网吧', '宾馆', '麻辣烫',
  '酸辣粉', '按摩', '大押', '燒鵝', '海味', '鐘錶', '刻印', '夜總會', '賓館', '抄手', '豆花', '洗衣', '五金', '跌打酒',
] as const;

/** the characters the neon's glyph atlas draws: every word's, and the square's own signs' (the build's atlas and the
 *  plugin's prepared one read this one list, so they always match) */
export const FONT_CHARS = [...new Set(chars(`${WORDS.join('')}九龍疊城萬家燈火天下一家福德正神九龍城重慶小麵纜車站九龍衙門鎮邪祥`))].join('');

/** the words hung as blade signs down the facades */
export const SIGN_WORDS = WORDS;
