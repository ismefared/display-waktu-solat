import { PrayerZone } from '../types/domain';

/**
 * Official JAKIM e-Solat Malaysian Prayer Zones Directory
 * Source: Jabatan Kemajuan Islam Malaysia (e-Solat Portal)
 * Traceability: PR-001, LOC-001, LOC-002,WX-001
 */
export const JAKIM_ZONES: PrayerZone[] = [
  // WILAYAH PERSEKUTUAN
  {
    code: 'WLY01',
    state: 'Wilayah Persekutuan',
    name: 'Kuala Lumpur, Putrajaya',
    lat: 3.1390,
    lng: 101.6869,
    weatherQuery: 'Kuala Lumpur',
  },
  {
    code: 'WLY02',
    state: 'Wilayah Persekutuan',
    name: 'Labuan',
    lat: 5.2831,
    lng: 115.2308,
    weatherQuery: 'Labuan',
  },

  // SELANGOR
  {
    code: 'SGR01',
    state: 'Selangor',
    name: 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, S.Alam',
    lat: 3.0738,
    lng: 101.5183,
    weatherQuery: 'Petaling',
  },
  {
    code: 'SGR02',
    state: 'Selangor',
    name: 'Kuala Selangor, Sabak Bernam',
    lat: 3.3402,
    lng: 101.2505,
    weatherQuery: 'Kuala Selangor',
  },
  {
    code: 'SGR03',
    state: 'Selangor',
    name: 'Klang, Kuala Langat',
    lat: 3.0449,
    lng: 101.4456,
    weatherQuery: 'Klang',
  },

  // JOHOR
  {
    code: 'JHR01',
    state: 'Johor',
    name: 'Pulau Aur dan Pulau Pemanggil',
    lat: 2.4486,
    lng: 104.5256,
    weatherQuery: 'Mersing',
  },
  {
    code: 'JHR02',
    state: 'Johor',
    name: 'Johor Bahru, Kota Tinggi, Mersing, Kulai',
    lat: 1.4927,
    lng: 103.7414,
    weatherQuery: 'Johor Bahru',
  },
  {
    code: 'JHR03',
    state: 'Johor',
    name: 'Kluang, Pontian',
    lat: 2.0305,
    lng: 103.3185,
    weatherQuery: 'Kluang',
  },
  {
    code: 'JHR04',
    state: 'Johor',
    name: 'Batu Pahat, Muar, Segamat, Gemas Johor, Tangkak',
    lat: 1.8548,
    lng: 102.9325,
    weatherQuery: 'Batu Pahat',
  },

  // KEDAH
  {
    code: 'KDH01',
    state: 'Kedah',
    name: 'Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)',
    lat: 6.1248,
    lng: 100.3678,
    weatherQuery: 'Kota Setar',
  },
  {
    code: 'KDH02',
    state: 'Kedah',
    name: 'Kuala Muda, Yan, Pendang',
    lat: 5.6470,
    lng: 100.4877,
    weatherQuery: 'Kuala Muda',
  },
  {
    code: 'KDH03',
    state: 'Kedah',
    name: 'Padang Terap, Sik',
    lat: 6.2568,
    lng: 100.6114,
    weatherQuery: 'Sik',
  },
  {
    code: 'KDH04',
    state: 'Kedah',
    name: 'Baling',
    lat: 5.6754,
    lng: 100.9178,
    weatherQuery: 'Baling',
  },
  {
    code: 'KDH05',
    state: 'Kedah',
    name: 'Bandar Baharu, Kulim',
    lat: 5.3657,
    lng: 100.5618,
    weatherQuery: 'Kulim',
  },
  {
    code: 'KDH06',
    state: 'Kedah',
    name: 'Langkawi',
    lat: 6.3500,
    lng: 99.8000,
    weatherQuery: 'Langkawi',
  },
  {
    code: 'KDH07',
    state: 'Kedah',
    name: 'Puncak Gunung Jerai',
    lat: 5.7875,
    lng: 100.4397,
    weatherQuery: 'Yan',
  },

  // KELANTAN
  {
    code: 'KTN01',
    state: 'Kelantan',
    name: 'Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai',
    lat: 6.1254,
    lng: 102.2381,
    weatherQuery: 'Kota Bharu',
  },
  {
    code: 'KTN02',
    state: 'Kelantan',
    name: 'Gua Musang (Daerah Galas dan Bertam), Jeli, Jajahan Kecil Lojing',
    lat: 4.8844,
    lng: 101.9686,
    weatherQuery: 'Gua Musang',
  },

  // MELAKA
  {
    code: 'MLK01',
    state: 'Melaka',
    name: 'Seluruh Negeri Melaka',
    lat: 2.1896,
    lng: 102.2501,
    weatherQuery: 'Melaka',
  },

  // NEGERI SEMBILAN
  {
    code: 'NGS01',
    state: 'Negeri Sembilan',
    name: 'Tampin, Jempol',
    lat: 2.7547,
    lng: 102.4048,
    weatherQuery: 'Jempol',
  },
  {
    code: 'NGS02',
    state: 'Negeri Sembilan',
    name: 'Jelebu, Kuala Pilah, Rembau',
    lat: 2.7389,
    lng: 102.2489,
    weatherQuery: 'Kuala Pilah',
  },
  {
    code: 'NGS03',
    state: 'Negeri Sembilan',
    name: 'Port Dickson, Seremban',
    lat: 2.7258,
    lng: 101.9424,
    weatherQuery: 'Seremban',
  },

  // PAHANG
  {
    code: 'PHG01',
    state: 'Pahang',
    name: 'Pulau Tioman',
    lat: 2.8169,
    lng: 104.1656,
    weatherQuery: 'Rompin',
  },
  {
    code: 'PHG02',
    state: 'Pahang',
    name: 'Kuantan, Pekan, Rompin, Muadzam Shah',
    lat: 3.8077,
    lng: 103.3260,
    weatherQuery: 'Kuantan',
  },
  {
    code: 'PHG03',
    state: 'Pahang',
    name: 'Jerantut, Temerloh, Maran, Bera, Chenor, Jengka',
    lat: 3.4506,
    lng: 102.4176,
    weatherQuery: 'Temerloh',
  },
  {
    code: 'PHG04',
    state: 'Pahang',
    name: 'Bentong, Lipis, Raub',
    lat: 3.7950,
    lng: 101.8570,
    weatherQuery: 'Bentong',
  },
  {
    code: 'PHG05',
    state: 'Pahang',
    name: 'Genting Sempah, Janda Baik, Bukit Tinggi',
    lat: 3.3540,
    lng: 101.8000,
    weatherQuery: 'Bentong',
  },
  {
    code: 'PHG06',
    state: 'Pahang',
    name: 'Cameron Highlands, Genting Higlands, Bukit Fraser',
    lat: 4.4718,
    lng: 101.3767,
    weatherQuery: 'Cameron Highlands',
  },

  // PERLIS
  {
    code: 'PLS01',
    state: 'Perlis',
    name: 'Kangar, Padang Besar, Arau',
    lat: 6.4414,
    lng: 100.1986,
    weatherQuery: 'Perlis',
  },

  // PULAU PINANG
  {
    code: 'PNG01',
    state: 'Pulau Pinang',
    name: 'Seluruh Negeri Pulau Pinang',
    lat: 5.4141,
    lng: 100.3288,
    weatherQuery: 'Pulau Pinang',
  },

  // PERAK
  {
    code: 'PRK01',
    state: 'Perak',
    name: 'Tapah, Slim River, Tanjung Malim',
    lat: 3.9964,
    lng: 101.3808,
    weatherQuery: 'Muallim',
  },
  {
    code: 'PRK02',
    state: 'Perak',
    name: 'Kuala Kangsar, Sg. Siput, Ipoh, Batu Gajah, Kampar',
    lat: 4.5975,
    lng: 101.0901,
    weatherQuery: 'Kinta',
  },
  {
    code: 'PRK03',
    state: 'Perak',
    name: 'Lenggong, Pengkalan Hulu, Grik',
    lat: 5.4281,
    lng: 101.1306,
    weatherQuery: 'Hulu Perak',
  },
  {
    code: 'PRK04',
    state: 'Perak',
    name: 'Temengor, Belum',
    lat: 5.5500,
    lng: 101.3500,
    weatherQuery: 'Hulu Perak',
  },
  {
    code: 'PRK05',
    state: 'Perak',
    name: 'Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor',
    lat: 4.0259,
    lng: 101.0213,
    weatherQuery: 'Manjung',
  },
  {
    code: 'PRK06',
    state: 'Perak',
    name: 'Selama, Taiping, Bagan Serai, Parit Buntar',
    lat: 4.8500,
    lng: 100.7333,
    weatherQuery: 'Larut, Matang Dan Selama',
  },
  {
    code: 'PRK07',
    state: 'Perak',
    name: 'Bukit Larut',
    lat: 4.8622,
    lng: 100.7931,
    weatherQuery: 'Larut, Matang Dan Selama',
  },

  // SABAH
  {
    code: 'SBH01',
    state: 'Sabah',
    name: 'Bahagian Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Bandar Sandakan, Sukau',
    lat: 5.8394,
    lng: 118.1172,
    weatherQuery: 'Sandakan',
  },
  {
    code: 'SBH02',
    state: 'Sabah',
    name: 'Beluran, Telupid, Pinangah, Terusan, Kuamut, Bahagian Sandakan (Barat)',
    lat: 5.8239,
    lng: 117.2450,
    weatherQuery: 'Beluran',
  },
  {
    code: 'SBH03',
    state: 'Sabah',
    name: 'Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Bahagian Tawau (Timur)',
    lat: 5.0267,
    lng: 118.3270,
    weatherQuery: 'Lahad Datu',
  },
  {
    code: 'SBH04',
    state: 'Sabah',
    name: 'Bandar Tawau, Balong, Merotai, Kalabakan, Bahagian Tawau (Barat)',
    lat: 4.2446,
    lng: 117.8912,
    weatherQuery: 'Tawau',
  },
  {
    code: 'SBH05',
    state: 'Sabah',
    name: 'Kudat, Kota Marudu, Pitas, Pulau Banggi, Bahagian Kudat',
    lat: 6.8831,
    lng: 116.8467,
    weatherQuery: 'Kudat',
  },
  {
    code: 'SBH06',
    state: 'Sabah',
    name: 'Gunung Kinabalu',
    lat: 6.0753,
    lng: 116.5588,
    weatherQuery: 'Ranau',
  },
  {
    code: 'SBH07',
    state: 'Sabah',
    name: 'Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan, Bahagian Pantai Barat',
    lat: 5.9804,
    lng: 116.0735,
    weatherQuery: 'Kota Kinabalu',
  },
  {
    code: 'SBH08',
    state: 'Sabah',
    name: 'Pensiangan, Keningau, Tambunan, Nabawan, Bahagian Pedalaman (Atas)',
    lat: 5.3378,
    lng: 116.1602,
    weatherQuery: 'Keningau',
  },
  {
    code: 'SBH09',
    state: 'Sabah',
    name: 'Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pasia, Membakut, Weston, Bahagian Pedalaman (Bawah)',
    lat: 5.3473,
    lng: 115.7455,
    weatherQuery: 'Beaufort',
  },

  // SARAWAK
  {
    code: 'SWK01',
    state: 'Sarawak',
    name: 'Limbang, Lawas, Sundar, Trusan',
    lat: 4.7500,
    lng: 115.0000,
    weatherQuery: 'Limbang',
  },
  {
    code: 'SWK02',
    state: 'Sarawak',
    name: 'Miri, Niah, Bekenu, Sibuti, Marudi',
    lat: 4.3995,
    lng: 113.9914,
    weatherQuery: 'Miri',
  },
  {
    code: 'SWK03',
    state: 'Sarawak',
    name: 'Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu',
    lat: 3.1713,
    lng: 113.0419,
    weatherQuery: 'Bintulu',
  },
  {
    code: 'SWK04',
    state: 'Sarawak',
    name: 'Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit',
    lat: 2.2873,
    lng: 111.8305,
    weatherQuery: 'Sibu',
  },
  {
    code: 'SWK05',
    state: 'Sarawak',
    name: 'Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai',
    lat: 2.1268,
    lng: 111.5186,
    weatherQuery: 'Sarikei',
  },
  {
    code: 'SWK06',
    state: 'Sarawak',
    name: 'Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkilili, Betong, Spaoh, Pusa, Saratok',
    lat: 1.2372,
    lng: 111.4620,
    weatherQuery: 'Sri Aman',
  },
  {
    code: 'SWK07',
    state: 'Sarawak',
    name: 'Serian, Simunjan, Samarahan, Sebuyau, Meludam',
    lat: 1.1687,
    lng: 110.5665,
    weatherQuery: 'Samarahan',
  },
  {
    code: 'SWK08',
    state: 'Sarawak',
    name: 'Kuching, Bau, Lundu, Sematan',
    lat: 1.5533,
    lng: 110.3592,
    weatherQuery: 'Kuching',
  },
  {
    code: 'SWK09',
    state: 'Sarawak',
    name: 'Zon Khas (Kampung Patarikan)',
    lat: 4.8200,
    lng: 115.4200,
    weatherQuery: 'Lawas',
  },

  // TERENGGANU
  {
    code: 'TRG01',
    state: 'Terengganu',
    name: 'Kuala Terengganu, Marang, Kuala Nerus',
    lat: 5.3296,
    lng: 103.1370,
    weatherQuery: 'Kuala Terengganu',
  },
  {
    code: 'TRG02',
    state: 'Terengganu',
    name: 'Besut, Setiu',
    lat: 5.7569,
    lng: 102.5597,
    weatherQuery: 'Besut',
  },
  {
    code: 'TRG03',
    state: 'Terengganu',
    name: 'Hulu Terengganu',
    lat: 5.0728,
    lng: 103.0144,
    weatherQuery: 'Hulu Terengganu',
  },
  {
    code: 'TRG04',
    state: 'Terengganu',
    name: 'Dungun, Kemaman',
    lat: 4.2332,
    lng: 103.4218,
    weatherQuery: 'Kemaman',
  },
];

export const JAKIM_STATES: string[] = Array.from(
  new Set(JAKIM_ZONES.map((z) => z.state))
);

export function getZoneByCode(code: string): PrayerZone {
  const found = JAKIM_ZONES.find(
    (z) => z.code.toUpperCase() === code.trim().toUpperCase()
  );
  return found || JAKIM_ZONES[0]; // Default to WLY01 if unknown
}
