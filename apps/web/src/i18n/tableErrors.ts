import type { TableError } from '../game/client';

const busy = 'මේසය කාර්යබහුලයි. මොහොතකින් නැවත උත්සාහ කරන්න.';
const missing = 'මේසය වසා ඇත, නැත්නම් කේතය වැරදියි.';
const expired = 'ඔබේ සැසිය අවසන්. මුල් පිටුවෙන් නැවත පටන් ගන්න.';

const messages: Readonly<Record<string, string>> = {
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
  ROOM_FULL: 'මේසයට දැනටමත් ක්‍රීඩකයන් හතර දෙනෙක් සිටිති.',
  ROOM_NOT_FOUND: missing,
  ROOM_EXPIRED: missing,
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

export function tableErrorCopy({ code, action }: TableError): string {
  if (code === 'REPORT_REJECTED' && action === 'report-no-trump')
    return 'තුරුම්පු කොළ නැත්නම් පළමු කොළය ගැසීමට පෙර යළි කොළ බෙදීමට ඉල්ලන්න.';
  return Object.hasOwn(messages, code)
    ? messages[code]!
    : 'මේසයට සම්බන්ධ විය නොහැක. නැවත උත්සාහ කරන්න.';
}
