import { DailyZikirItem } from '../types/domain';

/**
 * Verified Daily Zikir Dataset
 * Policy Compliance: Section 10, Section 36 (Verified Arabic Text, Translation & Hadith Reference)
 * Deterministic Daily Selection (ZIK-001)
 */

export const VERIFIED_DAILY_ZIKIR: DailyZikirItem[] = [
  {
    id: 'zikir-01',
    dayIndex: 0,
    titleBM: 'Tasbih & Tahmid Penyucian Jiwa',
    arabicText: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
    transliterationBM: 'Subhanallahi wa bihamdihi, Subhanallahil ‘Azim',
    translationBM:
      'Maha Suci Allah dan dengan kepujian-Nya, Maha Suci Allah Yang Maha Agung.',
    recommendedCount: 'Dibaca berulang kali (Amalan Harian)',
    sourceReference: 'Hadis Riwayat Al-Bukhari (6406) & Muslim (2694)',
  },
  {
    id: 'zikir-02',
    dayIndex: 1,
    titleBM: 'Hauqalah — Mohon Kekuatan & Pertolongan Allah',
    arabicText: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ',
    transliterationBM: 'La hawla wa la quwwata illa billahil ‘Aliyyil ‘Azim',
    translationBM:
      'Tiada daya dan tiada kekuatan melainkan dengan pertolongan Allah Yang Maha Tinggi lagi Maha Agung.',
    recommendedCount: '100 kali sehari',
    sourceReference: 'Hadis Riwayat Al-Bukhari (4205) & Muslim (2704)',
  },
  {
    id: 'zikir-03',
    dayIndex: 2,
    titleBM: 'Selawat Ke Atas Rasulullah SAW',
    arabicText: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ',
    transliterationBM:
      'Allahumma solli wa sallim ‘ala Nabiyyina Muhammad wa ‘ala alihi wa sahbihi ajma‘in',
    translationBM:
      'Ya Allah, limpahkanlah selawat dan salam ke atas Nabi kami Muhammad serta keluarga dan para sahabat Baginda seluruhnya.',
    recommendedCount: '100 kali sehari',
    sourceReference: 'Hadis Riwayat Muslim (408) & Panduan Zikir JAKIM',
  },
  {
    id: 'zikir-04',
    dayIndex: 3,
    titleBM: 'Istighfar — Memohon Keampunan Allah SWT',
    arabicText: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ',
    transliterationBM: 'Astaghfirullahal ‘Azim wa atubu ilaih',
    translationBM:
      'Aku memohon ampun kepada Allah Yang Maha Agung dan aku bertaubat kepada-Nya.',
    recommendedCount: '100 kali sehari',
    sourceReference: 'Hadis Riwayat Al-Bukhari (6307) & Muslim (2702)',
  },
  {
    id: 'zikir-05',
    dayIndex: 4,
    titleBM: 'Zikir Tauhid & Keesaan Allah SWT',
    arabicText: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    transliterationBM:
      'La ilaha illallahu wahdahu la syarika lah, lahul mulku wa lahul hamdu wa Huwa ‘ala kulli syai’in Qadir',
    translationBM:
      'Tiada Tuhan yang berhak disembah melainkan Allah Yang Maha Esa, tiada sekutu bagi-Nya; bagi-Nya segala kerajaan dan bagi-Nya segala pujian, dan Dia Maha Berkuasa atas segala sesuatu.',
    recommendedCount: '100 kali sehari',
    sourceReference: 'Hadis Riwayat Al-Bukhari (3293) & Muslim (2691)',
  },
  {
    id: 'zikir-06',
    dayIndex: 5,
    titleBM: 'Empat Kalimah Mulia (Al-Baqiyat As-Salihat)',
    arabicText: 'سُبْحَانَ اللَّهِ ، وَالْحَمْدُ لِلَّهِ ، وَلَا إِلَٰهَ إِلَّا اللَّهُ ، وَاللَّهُ أَكْبَرُ',
    transliterationBM:
      'Subhanallah, walhamdulillah, wa la ilaha illallah, wallahu Akbar',
    translationBM:
      'Maha Suci Allah, segala puji bagi Allah, tiada Tuhan yang berhak disembah melainkan Allah, dan Allah Maha Besar.',
    recommendedCount: '100 kali sehari',
    sourceReference: 'Hadis Riwayat Muslim (2137)',
  },
  {
    id: 'zikir-07',
    dayIndex: 6,
    titleBM: 'Zikir Penyerahan Diri & Tawakal (Hasbunallah)',
    arabicText: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    transliterationBM: 'Hasbunallahu wa ni‘mal Wakil',
    translationBM:
      'Cukuplah Allah sebagai Pelindung kami dan Dialah sebaik-baik Penjaga urusan.',
    recommendedCount: 'Dibaca pagi dan petang',
    sourceReference: 'Surah Ali ‘Imran Ayat 173 & Riwayat Al-Bukhari (4563)',
  },
];

/**
 * Deterministic daily zikir selector based on calendar date (YYYY-MM-DD).
 * Guarantees that the zikir remains stable across refreshes on the same day
 * and rotates cleanly each new day.
 */
export function resolveDailyZikirForDate(
  year: number,
  month: number,
  day: number
): DailyZikirItem {
  // Compute deterministic day-of-year index
  const utcDate = Date.UTC(year, month - 1, day);
  const startOfYear = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((utcDate - startOfYear) / (24 * 60 * 60 * 1000));
  const index = Math.abs(dayOfYear) % VERIFIED_DAILY_ZIKIR.length;
  return VERIFIED_DAILY_ZIKIR[index];
}
