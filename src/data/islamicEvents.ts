import { IslamicEventItem } from '../types/domain';

/**
 * Verified Malaysian Islamic Calendar Events (Takwim JAKIM)
 * Policy Compliance: Section 10, Section 36 (Zero Fabricated Religious Content)
 * Traceability: ISL-001
 */

export const HIJRI_MONTH_NAMES_BM: Record<number, string> = {
  1: 'Muharram',
  2: 'Safar',
  3: 'Rabiulawal',
  4: 'Rabiulakhir',
  5: 'Jamadilawal',
  6: 'Jamadilakhir',
  7: 'Rejab',
  8: 'Syaaban',
  9: 'Ramadan',
  10: 'Syawal',
  11: 'Zulkaedah',
  12: 'Zulhijjah',
};

export interface VerifiedHijriEventRecord {
  id: string;
  hijriMonth: number;
  hijriDay: number;
  titleBM: string;
  descriptionBM: string;
  category: 'WAJIB_SUNAT_MUAKKAD' | 'KEBESARAN_ISLAM' | 'AMALAN_BULANAN';
  sourceReference: string;
}

export const VERIFIED_ISLAMIC_EVENTS: VerifiedHijriEventRecord[] = [
  {
    id: 'isl-01-01',
    hijriMonth: 1,
    hijriDay: 1,
    titleBM: 'Awal Muharram (Maal Hijrah)',
    descriptionBM:
      'Permulaan tahun baharu Takwim Hijrah Islam memperingati peristiwa hijrah Rasulullah SAW dari Makkah ke Madinah.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-01-09',
    hijriMonth: 1,
    hijriDay: 9,
    titleBM: 'Hari Tasu’a (9 Muharram)',
    descriptionBM:
      'Hari disunatkan berpuasa beriringan dengan Hari Asyura menurut sunnah Rasulullah SAW.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Muslim (1134) & Takwim JAKIM',
  },
  {
    id: 'isl-01-10',
    hijriMonth: 1,
    hijriDay: 10,
    titleBM: 'Hari Asyura (10 Muharram)',
    descriptionBM:
      'Hari ke-10 bulan Muharram yang disunatkan berpuasa sebagai tanda syukur kepada Allah SWT.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Muslim (1162) & Takwim JAKIM',
  },
  {
    id: 'isl-03-12',
    hijriMonth: 3,
    hijriDay: 12,
    titleBM: 'Maulidur Rasul SAW (12 Rabiulawal)',
    descriptionBM:
      'Memperingati hari keputeraan Junjungan Besar Nabi Muhammad SAW serta menghayati sirah dan sunnah Baginda.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-07-27',
    hijriMonth: 7,
    hijriDay: 27,
    titleBM: 'Israk dan Mikraj (27 Rejab)',
    descriptionBM:
      'Memperingati peristiwa perjalanan malam Rasulullah SAW dari Masjidil Haram ke Masjidil Aqsa dan diangkat ke Sidratul Muntaha, di mana kefarduan solat lima waktu ditetapkan.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Surah Al-Isra’ Ayat 1 & Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-08-15',
    hijriMonth: 8,
    hijriDay: 15,
    titleBM: 'Nisfu Syaaban (15 Syaaban)',
    descriptionBM:
      'Pertengahan bulan Syaaban sebagai persiapan rohani menjelang ketibaan bulan Ramadan Al-Mubarak.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-09-01',
    hijriMonth: 9,
    hijriDay: 1,
    titleBM: 'Awal Ramadan (Permulaan Ibadah Puasa)',
    descriptionBM:
      'Permulaan kewajipan berpuasa sebulan penuh di bulan Ramadan bagi seluruh umat Islam.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Surah Al-Baqarah Ayat 183–185 & Takwim JAKIM',
  },
  {
    id: 'isl-09-17',
    hijriMonth: 9,
    hijriDay: 17,
    titleBM: 'Hari Nuzul Al-Quran (17 Ramadan)',
    descriptionBM:
      'Memperingati peristiwa penurunan wahyu pertama Al-Quran Al-Karim kepada Nabi Muhammad SAW di Gua Hira.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-09-21',
    hijriMonth: 9,
    hijriDay: 21,
    titleBM: 'Permulaan 10 Malam Terakhir Ramadan',
    descriptionBM:
      'Tempoh sepuluh malam terakhir Ramadan yang dianjurkan menghidupkan ibadah bagi mencari Lailatulqadar.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Al-Bukhari (2020) & Muslim (1174)',
  },
  {
    id: 'isl-10-01',
    hijriMonth: 10,
    hijriDay: 1,
    titleBM: 'Hari Raya Aidilfitri (1 Syawal)',
    descriptionBM:
      'Hari kemenangan umat Islam meraikan berakhirnya ibadah puasa bulan Ramadan dengan takbir dan solat sunat Aidilfitri.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-12-01',
    hijriMonth: 12,
    hijriDay: 1,
    titleBM: 'Awal Zulhijjah (10 Hari Awal Zulhijjah)',
    descriptionBM:
      'Permulaan sepuluh hari awal bulan Zulhijjah yang amat digalakkan memperbanyakkan amal soleh, zikir, dan puasa sunat.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Al-Bukhari (969) & Takwim JAKIM',
  },
  {
    id: 'isl-12-09',
    hijriMonth: 12,
    hijriDay: 9,
    titleBM: 'Hari Wukuf di Arafah (9 Zulhijjah)',
    descriptionBM:
      'Kemuncak ibadah haji di Padang Arafah dan disunatkan berpuasa Hari Arafah bagi umat Islam yang tidak mengerjakan haji.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Muslim (1162) & Takwim JAKIM',
  },
  {
    id: 'isl-12-10',
    hijriMonth: 12,
    hijriDay: 10,
    titleBM: 'Hari Raya Aidiladha (10 Zulhijjah)',
    descriptionBM:
      'Perayaan terbesar umat Islam memperingati pengorbanan Nabi Ibrahim AS dan Nabi Ismail AS dengan solat sunat Aidiladha dan ibadah korban.',
    category: 'KEBESARAN_ISLAM',
    sourceReference: 'Takwim Rasmi JAKIM',
  },
  {
    id: 'isl-12-11',
    hijriMonth: 12,
    hijriDay: 11,
    titleBM: 'Hari Tasyrik Pertama (11 Zulhijjah)',
    descriptionBM:
      'Hari makan, minum, dan mengingati Allah SWT serta pelaksanaan ibadah korban (diharamkan berpuasa pada 11, 12 dan 13 Zulhijjah).',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Muslim (1141) & Takwim JAKIM',
  },
  {
    id: 'isl-12-12',
    hijriMonth: 12,
    hijriDay: 12,
    titleBM: 'Hari Tasyrik Kedua (12 Zulhijjah)',
    descriptionBM:
      'Hari Tasyrik kedua bagi pelaksanaan ibadah korban dan memperbanyakkan takbir serta zikir kepada Allah SWT.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Muslim (1141) & Takwim JAKIM',
  },
  {
    id: 'isl-12-13',
    hijriMonth: 12,
    hijriDay: 13,
    titleBM: 'Hari Tasyrik Ketiga (13 Zulhijjah)',
    descriptionBM:
      'Hari terakhir Hari Tasyrik dan penutup tempoh pelaksanaan penyembelihan ibadah korban.',
    category: 'WAJIB_SUNAT_MUAKKAD',
    sourceReference: 'Hadis Riwayat Muslim (1141) & Takwim JAKIM',
  },
];

/**
 * Resolves the Islamic event for a given Hijri year, month, and day.
 * Never fabricates dates. If no exact event falls on today's Hijri date,
 * checks Ayyamul Bidh (13, 14, 15 of Hijri month except 13 Zulhijjah)
 * or returns the next upcoming verified Islamic event with `isExactToday: false`.
 */
export function resolveIslamicEventForHijriDate(
  hijriYear: number,
  hijriMonth: number,
  hijriDay: number
): {
  todayEvent: IslamicEventItem | null;
  upcomingEvent: IslamicEventItem;
  statusMessageBM: string;
} {
  const monthName = HIJRI_MONTH_NAMES_BM[hijriMonth] || 'Hijrah';

  // 1. Check exact annual Islamic event match
  const exactMatch = VERIFIED_ISLAMIC_EVENTS.find(
    (e) => e.hijriMonth === hijriMonth && e.hijriDay === hijriDay
  );

  // 2. Find next upcoming event in the Hijri year cycle
  const upcomingRecord =
    VERIFIED_ISLAMIC_EVENTS.find(
      (e) =>
        e.hijriMonth > hijriMonth ||
        (e.hijriMonth === hijriMonth && e.hijriDay > hijriDay)
    ) || VERIFIED_ISLAMIC_EVENTS[0];

  const upcomingYear =
    upcomingRecord.hijriMonth < hijriMonth ||
    (upcomingRecord.hijriMonth === hijriMonth && upcomingRecord.hijriDay <= hijriDay)
      ? hijriYear + 1
      : hijriYear;

  const upcomingEvent: IslamicEventItem = {
    ...upcomingRecord,
    hijriDateDisplay: `${upcomingRecord.hijriDay} ${HIJRI_MONTH_NAMES_BM[upcomingRecord.hijriMonth]} ${upcomingYear}H`,
    isExactToday: false,
  };

  if (exactMatch) {
    return {
      todayEvent: {
        ...exactMatch,
        hijriDateDisplay: `${hijriDay} ${monthName} ${hijriYear}H`,
        isExactToday: true,
      },
      upcomingEvent,
      statusMessageBM: `Peristiwa Hari Ini (${hijriDay} ${monthName} ${hijriYear}H)`,
    };
  }

  // 3. Check Ayyamul Bidh (13, 14, 15 of every Hijri month, excluding 13 Zulhijjah which is Tasyrik)
  if (
    (hijriDay === 13 || hijriDay === 14 || hijriDay === 15) &&
    !(hijriMonth === 12 && hijriDay === 13) &&
    hijriMonth !== 9 // Ramadan is already obligatory fasting
  ) {
    return {
      todayEvent: {
        id: `ayyamul-bidh-${hijriMonth}-${hijriDay}`,
        hijriMonth,
        hijriDay,
        hijriDateDisplay: `${hijriDay} ${monthName} ${hijriYear}H`,
        titleBM: `Hari Putih (Ayyamul Bidh — ${hijriDay} ${monthName})`,
        descriptionBM:
          'Tarikh 13, 14, dan 15 setiap bulan Hijrah (Hari Putih) yang dianjurkan berpuasa sunat.',
        category: 'AMALAN_BULANAN',
        sourceReference: 'Hadis Riwayat An-Nasa’i (2424) & Abu Dawud (2449)',
        isExactToday: true,
      },
      upcomingEvent,
      statusMessageBM: `Amalan Sunat Hari Ini (${hijriDay} ${monthName} ${hijriYear}H)`,
    };
  }

  // 4. Explicit "no special event today" state per ISL-001 requirement
  return {
    todayEvent: null,
    upcomingEvent,
    statusMessageBM: `Tiada peristiwa khas Islam pada ${hijriDay} ${monthName} ${hijriYear}H`,
  };
}
