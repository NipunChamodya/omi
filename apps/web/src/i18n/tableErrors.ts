import type { TableError } from '../game/client';

const busy = 'මේසය කාර්යබහුලයි. මොහොතකින් නැවත උත්සාහ කරන්න.';
const missing = 'මේසය වසා ඇත, නැත්නම් කේතය වැරදියි.';
const expired = 'ඔබේ සැසිය අවසන්. මුල් පිටුවෙන් නැවත පටන් ගන්න.';

const sinhala = {
  REMATCH_UNAVAILABLE: 'මේ මේසයේ නැවත තරගයක් ඇරඹිය නොහැක.',
  REMATCH_WAITING:
    'සියලු ක්‍රීඩකයන් යළි සම්බන්ධ වී පිළිගන්නා තෙක් රැඳී සිටින්න.',
  TURN_EXPIRED: 'ඔබේ වාරයේ කාලය අවසන්. මේසය යාවත්කාලීන වෙමින් පවතී.',
  MATCH_COMPLETE: 'තරගය අවසන්.',
  ROUND_NOT_SETTLED: 'ඊළඟ වටයට පෙර දැන් ක්‍රීඩා කරන වටය අවසන් කරන්න.',
  BOT_NOT_ALLOWED:
    'හිස් අසුන් ඇති සාමාන්‍ය මේසයකට පමණක් බොට් ක්‍රීඩකයන් එක් කළ හැක.',
  VERSION_CONFLICT: 'මේසයේ තත්ත්වය වෙනස් වී ඇත. යළි උත්සාහ කරන්න.',
  INVALID_GAME_ACTION: 'එම කොළය ගැසීමට නොහැක. ඔබේ කොළ යාවත්කාලීන කර ඇත.',
  INVALID_ROOM_CODE: 'මේසය සෑදූ ක්‍රීඩකයා දුන් අක්ෂර අටේ කේතය ඇතුළත් කරන්න.',
  ROOM_CLOSED: 'මෙම මේසයේ තරගය දැනටමත් ආරම්භ වී ඇත.',
  ROOM_FULL: 'මේසයට දැනටමත් ක්‍රීඩකයන් හතර දෙනෙක් සිටිති.',
  ROOM_NOT_FOUND: missing,
  ROOM_EXPIRED: 'ඔබ එක් වෙමින් සිටියදී මේසය වැසුණා. අලුත් කේතයක් ඉල්ලන්න.',
  SEAT_CHANGED: 'ඔබේ වෙන් කළ මේසය වෙනස් වී ඇත. මෙහි පෙන්වන මේසයට යළි එක් වන්න.',
  NETWORK:
    'සම්බන්ධ වීමට නොහැකි විය. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කර යළි උත්සාහ කරන්න.',
  SERVICE_UNAVAILABLE:
    'ක්‍රීඩා සේවාදායකය තාවකාලිකව ලබා ගත නොහැක. මොහොතකින් යළි උත්සාහ කරන්න.',
  ALREADY_IN_ROOM: 'ඔබට දැනටමත් මේසයක අසුනක් තිබේ. එම මේසයට ආපසු යන්න.',
  LOGIN_REQUIRED: 'අසුනක් ගැනීමට Google හරහා පිවිසෙන්න.',
  SESSION_REQUIRED: expired,
  SESSION_EXPIRED: expired,
  FOUR_READY_PLAYERS_REQUIRED:
    'ක්‍රීඩකයන් හතර දෙනාම සම්බන්ධ වී සූදානම් විය යුතුයි.',
  RATE_LIMITED: busy,
  ROOM_BUSY: busy,
  ROOM_CAPACITY: busy,
  CONNECTION_CAPACITY: busy,
  SERVICE_STOPPING: busy,
  ACTION_BUDGET_EXHAUSTED: 'මේ මේසයේ ක්‍රියා සීමාවට පැමිණ ඇත.',
  ACTION_ID_REUSED: 'එම ඉල්ලීම කලින් භාවිත කර ඇත. නැවත උත්සාහ කරන්න.',
  HOST_REQUIRED: 'එය කළ හැක්කේ මේසය සෑදූ ක්‍රීඩකයාට පමණි.',
  REPORT_REJECTED: 'වාර්තාව තහවුරු කිරීමට නොහැකි විය.',
  REPORT_ALREADY_APPLIED: 'එම වාර්තාව දැනටමත් සලකා ඇත.',
};

const tamilBusy =
  'மேசை தற்போது பரபரப்பாக உள்ளது. சிறிது நேரம் கழித்து மீண்டும் முயற்சி செய்யவும்.';
const tamilExpired =
  'உங்கள் அமர்வு முடிந்துவிட்டது. முகப்பிலிருந்து மீண்டும் தொடங்கவும்.';
const tamil: Record<keyof typeof sinhala, string> = {
  REMATCH_UNAVAILABLE: 'இந்த மேசையில் மறுபோட்டியைத் தொடங்க முடியாது.',
  REMATCH_WAITING:
    'அனைத்து வீரர்களும் மீண்டும் இணைந்து ஒப்புக்கொள்ளும் வரை காத்திருக்கவும்.',
  TURN_EXPIRED: 'உங்கள் முறைக்கான நேரம் முடிந்தது. மேசை புதுப்பிக்கப்படுகிறது.',
  MATCH_COMPLETE: 'ஆட்டம் முடிந்துவிட்டது.',
  ROUND_NOT_SETTLED:
    'அடுத்த சுற்றுக்குச் செல்லுமுன் இந்தச் சுற்றை முடிக்கவும்.',
  BOT_NOT_ALLOWED:
    'காலி இருக்கைகள் உள்ள சாதாரண மேசையில் மட்டுமே கணினி வீரரைச் சேர்க்கலாம்.',
  VERSION_CONFLICT: 'மேசையின் நிலை மாறிவிட்டது. மீண்டும் முயற்சி செய்யவும்.',
  INVALID_GAME_ACTION:
    'அந்தச் சீட்டைப் போட முடியவில்லை. உங்கள் சீட்டுகள் புதுப்பிக்கப்பட்டன.',
  INVALID_ROOM_CODE:
    'மேசையைத் தொடங்கியவர் கொடுத்த எட்டு எழுத்துக் குறியீட்டை உள்ளிடவும்.',
  ROOM_CLOSED: 'இந்த மேசையின் ஆட்டம் ஏற்கெனவே தொடங்கிவிட்டது.',
  ROOM_FULL: 'இந்த மேசையில் ஏற்கெனவே நான்கு வீரர்கள் உள்ளனர்.',
  ROOM_NOT_FOUND: 'மேசை மூடப்பட்டிருக்கலாம் அல்லது குறியீடு தவறாக இருக்கலாம்.',
  ROOM_EXPIRED:
    'நீங்கள் சேரும்போது மேசை மூடப்பட்டது. புதிய குறியீட்டைக் கேட்கவும்.',
  SEAT_CHANGED:
    'உங்கள் சேமித்த இருக்கை மாறிவிட்டது. இங்கே காட்டப்படும் மேசையில் சேரவும்.',
  NETWORK:
    'இணைக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சி செய்யவும்.',
  SERVICE_UNAVAILABLE:
    'விளையாட்டுச் சேவை தற்காலிகமாகக் கிடைக்கவில்லை. மீண்டும் முயற்சி செய்யவும்.',
  ALREADY_IN_ROOM:
    'உங்களுக்கு ஏற்கெனவே ஓர் இருக்கை உள்ளது. அந்த மேசைக்குத் திரும்பவும்.',
  LOGIN_REQUIRED: 'இருக்கையைப் பெற Google மூலம் உள்நுழையவும்.',
  SESSION_REQUIRED: tamilExpired,
  SESSION_EXPIRED: tamilExpired,
  FOUR_READY_PLAYERS_REQUIRED:
    'நான்கு வீரர்களும் இணைந்து தயாராக இருக்க வேண்டும்.',
  RATE_LIMITED: tamilBusy,
  ROOM_BUSY: tamilBusy,
  ROOM_CAPACITY: tamilBusy,
  CONNECTION_CAPACITY: tamilBusy,
  SERVICE_STOPPING: tamilBusy,
  ACTION_BUDGET_EXHAUSTED:
    'இந்த மேசையின் செயல்களுக்கான வரம்பை அடைந்துவிட்டீர்கள்.',
  ACTION_ID_REUSED:
    'இந்தக் கோரிக்கை ஏற்கெனவே பயன்படுத்தப்பட்டது. மீண்டும் முயற்சி செய்யவும்.',
  HOST_REQUIRED: 'மேசையைத் தொடங்கியவர் மட்டுமே இதைச் செய்யலாம்.',
  REPORT_REJECTED: 'புகாரை உறுதிப்படுத்த முடியவில்லை.',
  REPORT_ALREADY_APPLIED: 'அந்தப் புகார் ஏற்கெனவே பரிசீலிக்கப்பட்டது.',
};

export function tableErrorCopy(
  { code, action }: TableError,
  language: 'si' | 'ta' = 'si',
): string {
  if (code === 'REPORT_REJECTED' && action === 'report-no-trump')
    return language === 'ta'
      ? 'துருப்புச் சீட்டு இல்லையெனில் முதல் சீட்டைப் போடுமுன் மீண்டும் பகிரக் கோரவும்.'
      : 'තුරුම්පු කොළ නැත්නම් පළමු කොළය ගැසීමට පෙර යළි කොළ බෙදීමට ඉල්ලන්න.';
  const messages = language === 'ta' ? tamil : sinhala;
  return Object.hasOwn(messages, code)
    ? messages[code as keyof typeof messages]
    : language === 'ta'
      ? 'மேசையுடன் இணைய முடியவில்லை. மீண்டும் முயற்சி செய்யவும்.'
      : 'මේසයට සම්බන්ධ විය නොහැක. නැවත උත්සාහ කරන්න.';
}
