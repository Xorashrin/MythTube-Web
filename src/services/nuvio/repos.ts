// Nuvio plugin repositories (manifest.json + provider scripts on raw.githubusercontent.com).
// Verified live on 2026-10-21. Repos that were taken down (nvmindl, realbestia1, Gowaru) are not listed.
export interface NuvioRepo {
  id: string;
  name: string;
  base: string;
  /** Lower runs first. */
  priority: number;
  /** Language tag of the repo's catalog. */
  lang: 'multi' | 'tr' | 'ar' | 'es' | 'ta' | 'bn' | 'pt' | 'fr' | 'de' | 'it' | 'ro';
}

const RAW = 'https://raw.githubusercontent.com';

/** Mutable on purpose: remote config (config/sources.json) can add, drop or reorder repositories without an app update. */
export const NUVIO_REPOS: NuvioRepo[] = [
  { id: 'd3', name: 'All-in-One', base: `${RAW}/D3adlyRocket/All-in-One-Nuvio/refs/heads/main`, priority: 0, lang: 'multi' },
  { id: 'ph', name: 'Phisher', base: `${RAW}/phisher98/phisher-nuvio-providers/refs/heads/main`, priority: 1, lang: 'multi' },
  { id: 'yo', name: 'Yoru', base: `${RAW}/yoruix/nuvio-providers/refs/heads/main`, priority: 2, lang: 'multi' },
  { id: 'mi', name: 'Michat88', base: `${RAW}/michat88/nuvio-providers/refs/heads/main`, priority: 3, lang: 'multi' },
  { id: 'bd', name: 'BDIX streams', base: `${RAW}/ahnaf0014/bdix-nuvio-providers/main`, priority: 4, lang: 'bn' },
  { id: 'sp', name: 'Spidey (Tamil)', base: `${RAW}/Abinanthankv/NuvioRepo/refs/heads/master`, priority: 5, lang: 'ta' },
  { id: 'r7', name: 'Range7 (Arabic)', base: `${RAW}/Range7/Nuvio-Plugin/main`, priority: 6, lang: 'ar' },
  { id: 'ke', name: 'KennethJYS (Latino)', base: `${RAW}/KennethJYS/Nuvio-Providers-Latino/refs/heads/main`, priority: 7, lang: 'es' },
  { id: 'mc', name: 'MoonCrown (Turkish)', base: `${RAW}/mooncrown04/nuviotr/refs/heads/main`, priority: 8, lang: 'tr' },
  { id: 'sa', name: 'Saimuelbr (PT-BR)', base: `${RAW}/saimuelbr/saimuel-nuvio-repo/refs/heads/main`, priority: 9, lang: 'pt' },
  { id: 'ar', name: 'ArabibZ', base: `${RAW}/ArabibZ/nuvio-providers/master`, priority: 10, lang: 'ar' },
  { id: 'nia', name: 'NiakVIO', base: `${RAW}/niakw/NiakVIO/refs/heads/main`, priority: 20, lang: 'fr' },
  { id: 'rar', name: 'Rare Anime', base: `${RAW}/rareanimeaddon-blip/Nuvio-plugins/refs/heads/main`, priority: 21, lang: 'multi' },
  { id: 'hhh', name: 'Tokyo Insider & more', base: `${RAW}/hihihihihiiray/nuvio-plugins/refs/heads/main`, priority: 22, lang: 'multi' },
  { id: 'zay', name: 'Zayntoun', base: `${RAW}/Zayntoun/nuvio-plugins/refs/heads/main`, priority: 23, lang: 'multi' },
  { id: 'afa', name: 'Afanag (Hindi)', base: `${RAW}/afanag/nuvio-providers/refs/heads/main`, priority: 24, lang: 'multi' },
  { id: 'beb', name: 'Bebo (Anime/Arabic)', base: `${RAW}/bebokurd/nuvio-plugins/refs/heads/main`, priority: 25, lang: 'ar' },
  { id: 'ibe', name: 'Iberia', base: `${RAW}/iberiaimm/nuvio-providers/refs/heads/main`, priority: 26, lang: 'multi' },
  { id: 'lio', name: 'Lions', base: `${RAW}/lions-can-code-everyday/Nuvio-Providers/refs/heads/main`, priority: 27, lang: 'multi' },
  { id: 'koe', name: 'Pengu', base: `${RAW}/koerakutsa/pengu-nuvio-plugins/refs/heads/main`, priority: 28, lang: 'multi' },
  { id: 'umm', name: 'Doom', base: `${RAW}/ummarm/Doom-plug/refs/heads/main`, priority: 29, lang: 'multi' },
  { id: 'ahm', name: 'Ahmed', base: `${RAW}/ahmedelkassrawy/nuvio-providers/refs/heads/main`, priority: 30, lang: 'multi' },
  { id: 'ari', name: 'Arif', base: `${RAW}/arifbutitv/My_Nuvio_plugins/refs/heads/main`, priority: 31, lang: 'multi' },
  { id: 'tha', name: 'NTL', base: `${RAW}/thanhluancklk/ntl-nuvio-plugins/refs/heads/main`, priority: 32, lang: 'multi' },
  { id: 'mkv', name: 'FlixIndia', base: `${RAW}/mkv9903/NuvioProviders/refs/heads/main`, priority: 33, lang: 'multi' },
  { id: 'hem', name: 'Anime Heman', base: `${RAW}/hemanthmannam/NuvioAnime-Heman/refs/heads/main`, priority: 34, lang: 'multi' },
  { id: 'mus', name: 'Anikoto', base: `${RAW}/Mush-iii/nuvio-anime/refs/heads/main`, priority: 35, lang: 'multi' },
  { id: 'van', name: 'Donghua/Anime', base: `${RAW}/vanomarb/anime-scraper/refs/heads/main`, priority: 36, lang: 'multi' },
  { id: 'tri', name: 'Videasy/Vidfast', base: `${RAW}/Trixjustbetter/videasy-nuvio/refs/heads/main`, priority: 37, lang: 'multi' },
  { id: 'mak', name: 'KissKH', base: `${RAW}/makeran218/nuvio-providers/refs/heads/main`, priority: 38, lang: 'multi' },
  { id: 'a4u', name: 'Anime4up', base: `${RAW}/1995BK201/nuvio-anime4up/refs/heads/main`, priority: 39, lang: 'ar' },
  { id: 'sub', name: 'BDIX ICC/BanglaPlex', base: `${RAW}/subirmazumdar/nuvio-provider/refs/heads/main`, priority: 40, lang: 'bn' },
  { id: 'mfq', name: 'BDIX DhakaFlix', base: `${RAW}/mushfiqamin/nuvio-providers/refs/heads/main`, priority: 41, lang: 'bn' },
  { id: 'nil', name: 'DhakaFlix (Niloy)', base: `${RAW}/Niloy-Sarker/nuvio-plugins/refs/heads/master`, priority: 42, lang: 'bn' },
  { id: 'taz', name: 'DhakaFlix (Tazihad)', base: `${RAW}/tazihad/nuvio-plugins/refs/heads/main`, priority: 43, lang: 'bn' },
  { id: 'gow', name: 'Gowaru (French)', base: `${RAW}/Gowaru/gowaru-nuvio-providers/refs/heads/main`, priority: 44, lang: 'fr' },
  { id: 'bli', name: 'Nakios/Purstream', base: `${RAW}/blizzx4644/Nuvio_plugins/refs/heads/main`, priority: 45, lang: 'fr' },
  { id: 'mun', name: 'Latam Anime', base: `${RAW}/municipalidad1998/nuvio-providers/refs/heads/main`, priority: 46, lang: 'es' },
  { id: 'cry', name: 'AnimeFLV', base: `${RAW}/CrypticShampoos/Nuvio-Anime-Test/refs/heads/main`, priority: 47, lang: 'es' },
  { id: 'mo7', name: 'Arabic Anime', base: `${RAW}/mo7AmMeD64/nuvio-plugins/refs/heads/main`, priority: 48, lang: 'ar' },
  { id: 'man', name: 'Turkish (Manitux)', base: `${RAW}/manitux-app/nuvio-plugins/refs/heads/main`, priority: 49, lang: 'tr' },
  { id: 'kho', name: 'Turkish (KhooLy)', base: `${RAW}/KhooLy/nuvio-providers/refs/heads/master`, priority: 50, lang: 'tr' },
  { id: 'onr', name: 'Turkish Anime', base: `${RAW}/onrcvndev/nuvio-providers/refs/heads/main`, priority: 51, lang: 'tr' },
  { id: 's09', name: 'StreamNest (German)', base: `${RAW}/s09x/StreamNest/refs/heads/main`, priority: 52, lang: 'de' },
  { id: 'fen', name: 'Italian', base: `${RAW}/fenrir22/NuvioIT/refs/heads/main`, priority: 53, lang: 'it' },
  { id: 'a2r', name: 'Romanian', base: `${RAW}/A2R14N/nuvio-providers/refs/heads/main`, priority: 54, lang: 'ro' },
];
