import { create } from 'zustand';

const key = 'omi.language';
function initial(): 'en' | 'si' {
  try {
    return localStorage.getItem(key) === 'si' ? 'si' : 'en';
  } catch {
    return 'en';
  }
}

export const useLocale = create<{
  language: 'en' | 'si';
  change: (language: 'en' | 'si') => void;
}>((set) => ({
  language: initial(),
  change: (language) => {
    try {
      localStorage.setItem(key, language);
    } catch {
      /* Session preference still works. */
    }
    set({ language });
  },
}));

const sinhala = {
  Home: 'මුල් පිටුව',
  'Four friends.': 'යහළුවන් හතර දෙනෙක්.',
  'One table.': 'එකම මේසයක්.',
  'Learn to play': 'ක්‍රීඩා කරන්න ඉගෙන ගන්න',
  'Your seat is saved.': 'ඔබේ අසුන වෙන් කර ඇත.',
  'Return to your table': 'ඔබේ මේසයට ආපසු යන්න',
  'Your friends are waiting.': 'ඔබේ යහළුවෝ බලා සිටිති.',
  'Bring your people.': 'යහළුවන් එක් කරගන්න.',
  'Your name': 'ඔබේ නම',
  'Table code': 'මේස කේතය',
  'Create a table': 'මේසයක් සාදන්න',
  'Join a table': 'මේසයකට එක්වන්න',
  'Join table': 'මේසයට එක්වන්න',
  Multiplayer: 'බහු ක්‍රීඩක',
  Back: 'ආපසු',
  'Your table is ready.': 'ඔබේ මේසය සූදානම්.',
  'Ready to play': 'ක්‍රීඩා කිරීමට සූදානම්',
  'Not ready': 'තවම සූදානම් නැත',
  'Start game': 'ක්‍රීඩාව අරඹන්න',
  'Add a bot': 'පරිගණක ක්‍රීඩකයෙකු එක් කරන්න',
  'Copy invite link': 'ආරාධනා සබැඳිය පිටපත් කරන්න',
  Reconnecting: 'නැවත සම්බන්ධ වෙමින්',
  'Your hand': 'ඔබේ අත',
  'Your team': 'ඔබේ පිල',
  'Their team': 'අනෙක් පිල',
  TRUMP: 'තුරුම්පු',
  'Next round': 'ඊළඟ වටය',
  'Play again': 'නැවත ක්‍රීඩා කරමු',
  'Waiting for rematch': 'අනෙක් අයගේ පිළිතුරු බලා සිටිමු',
  'Return home': 'මුල් පිටුවට යන්න',
  'Cut the deck.': 'කොළ කුට්ටම කපන්න.',
  'Choose trump.': 'තුරුම්පු තෝරන්න.',
  'Round complete.': 'වටය අවසන්.',
  'Match complete.': 'තරගය අවසන්.',
  'Your team won!': 'ඔබේ පිල දිනුවා!',
  'The other team won!': 'අනෙක් පිල දිනුවා!',
  'Both teams forfeited': 'පිල් දෙකම තරගයෙන් ඉවත් වුණා',
  'Select a card to play': 'ගැසීමට කොළයක් තෝරන්න',
  'Waiting for your turn': 'ඔබේ වාරය එනතුරු සිටින්න',
  'Your turn. Choose a card.': 'ඔබේ වාරයයි. කොළයක් තෝරන්න.',
  'Your lead. Choose a card.': 'ඔබ පටන් ගන්න. කොළයක් තෝරන්න.',
  'Table history & reports': 'වටයේ විස්තර සහ වාර්තා',
  Friends: 'යහළුවෝ',
  'Refresh invitations': 'ආරාධනා යාවත්කාලීන කරන්න',
  'Invite to table': 'මේසයට ආරාධනා කරන්න',
  'Invite as teammate': 'පිලේ සහකරු ලෙස ආරාධනා කරන්න',
  Decline: 'ප්‍රතික්ෂේප කරන්න',
  'Your profile': 'ඔබේ පැතිකඩ',
  Moderation: 'වාර්තා පරීක්ෂාව',
  'Play Online': 'අන්තර්ජාලයෙන් ක්‍රීඩා කරන්න',
  'Play with Friends': 'යහළුවන් සමඟ ක්‍රීඩා කරන්න',
  'Find players': 'ක්‍රීඩකයන් සොයන්න',
  'Skip to content': 'අන්තර්ගතයට යන්න',
  'My profile': 'මගේ පැතිකඩ',
  'Dismiss sign-in message': 'පිවිසුම් පණිවිඩය වසන්න',
  'Dismiss message': 'පණිවිඩය වසන්න',
  'Sound & tools': 'ශබ්ද සහ මෙවලම්',
  Reconnect: 'නැවත සම්බන්ධ වන්න',
  'Opening the table…': 'මේසය විවෘත කරමින්…',
  'Setting your table…': 'මේසය සූදානම් කරමින්…',
  'Table settings and voice': 'මේස සැකසුම් සහ හඬ',
  'Game settings': 'ක්‍රීඩා සැකසුම්',
  'Back to game': 'ක්‍රීඩාවට ආපසු යන්න',
  'Loading room controls…': 'මේසයේ මෙවලම් පූරණය වෙමින්…',
  'Return from your table?': 'මේසයෙන් ඉවත් වෙනවාද?',
  'Your seat, hand and scores stay at the server. Your friends will see you reconnect when you return.':
    'ඔබේ අසුන, කොළ සහ ලකුණු සුරැකේ. ආපසු පැමිණි විට යහළුවන්ට පෙනෙනු ඇත.',
  'Keep playing': 'දිගටම ක්‍රීඩා කරන්න',
  'Return home and keep my seat': 'අසුන තබාගෙන මුල් පිටුවට යන්න',
  'Opening your profile…': 'පැතිකඩ විවෘත කරමින්…',
  'Made for the way we play.': 'අපි ක්‍රීඩා කරන විදිහටම.',
  'Continue with Google': 'Google සමඟ ඉදිරියට යන්න',
  'Create a private table or join your friends with an invite code.':
    'පෞද්ගලික මේසයක් සාදන්න, නැත්නම් ආරාධනා කේතයකින් යහළුවන්ට එක්වන්න.',
  'Create Room': 'කාමරයක් සාදන්න',
  'Join Room': 'කාමරයට එක්වන්න',
  'Four signed-in people. No bots and no simulated players.':
    'පිවිසුණු සැබෑ ක්‍රීඩකයන් හතර දෙනෙක්.',
  'Sign in to join the ranked, human-only queue.':
    'ශ්‍රේණිගත තරගයකට එක්වීමට පිවිසෙන්න.',
  'Cancel search': 'සෙවීම නවත්වන්න',
  'App settings': 'යෙදුම් සැකසුම්',
  'Data Saver Mode': 'දත්ත ඉතිරි කිරීම',
  'Install & data settings': 'ස්ථාපනය සහ දත්ත සැකසුම්',
  'Install OMI': 'ඕමි ස්ථාපනය කරන්න',
  'Offline setup is unavailable. OMI can still be used online.':
    'නොබැඳි සැකසුම ලබා ගත නොහැක. අන්තර්ජාලය සමඟ ඕමි ක්‍රීඩා කළ හැක.',
  'Loading practice…': 'පුහුණුව පූරණය වෙමින්…',
  'WELCOME BACK': 'නැවත සාදරයෙන් පිළිගනිමු',
  'Checking your session…': 'ඔබේ පිවිසුම පරීක්ෂා කරමින්…',
  'Google sign-in is not available at this table yet.':
    'මේ මේසයට Google පිවිසුම තවම ලබා ගත නොහැක.',
  'Sign in to save your profile and take your seat.':
    'පැතිකඩ සුරැකීමට සහ අසුන ගැනීමට පිවිසෙන්න.',
  'already have an invite?': 'ආරාධනාවක් තිබෙනවාද?',
  'Private tables. Familiar rules.': 'පෞද්ගලික මේස. හුරුපුරුදු නීති.',
  'Load recent reports': 'මෑත වාර්තා පෙන්වන්න',
  'Mark reviewed': 'පරීක්ෂා කළ බව සලකුණු කරන්න',
  'Dismiss report': 'වාර්තාව ඉවත් කරන්න',
  'Reopen report': 'වාර්තාව යළි විවෘත කරන්න',
  'No recent reports.': 'මෑත වාර්තා නැත.',
  'Reports updated.': 'වාර්තා යාවත්කාලීන විය.',
  'Could not update reports. Refresh and try again.':
    'වාර්තා යාවත්කාලීන කළ නොහැකි විය. නැවත උත්සාහ කරන්න.',
  'OMI home': 'ඕමි මුල් පිටුව',
  'Chat and voice are off at ranked tables.':
    'ශ්‍රේණිගත මේසවල කතාබහ සහ හඬ අක්‍රියයි.',
  'TABLE CODE': 'මේස කේතය',
  'Copy code': 'කේතය පිටපත් කරන්න',
  'Four table seats': 'මේසයේ අසුන් හතර',
  YOU: 'ඔබ',
  'You and your teammate will sit opposite each other.':
    'ඔබ සහ ඔබේ සහකරු මුහුණට මුහුණ අසුන් ගනී.',
  Advertisement: 'වෙළඳ දැන්වීම',
  'YOUR PLACE AT THE TABLE': 'මේසයේ ඔබේ ස්ථානය',
  'Match statistics': 'තරග සංඛ්‍යාලේඛන',
  'Recent rating changes': 'මෑත ශ්‍රේණි වෙනස්කම්',
  'Experimental leaderboard': 'අත්හදා බැලීමේ ශ්‍රේණි ලැයිස්තුව',
  Partnerships: 'සහකරු යුගල',
  'Recent matches': 'මෑත තරග',
  'Close profile': 'පැතිකඩ වසන්න',
  'Signed in with Google': 'Google සමඟ පිවිස ඇත',
  'Display name': 'පෙන්වන නම',
  'Save name': 'නම සුරකින්න',
  'Profile photo': 'පැතිකඩ ඡායාරූපය',
  'Choose from your gallery, then frame it your way.':
    'ගැලරියෙන් ඡායාරූපයක් තෝරා රාමුව සකසන්න.',
  'Choose profile photo': 'පැතිකඩ ඡායාරූපයක් තෝරන්න',
  'Photo uploads are not available right now.': 'දැනට ඡායාරූප එක් කළ නොහැක.',
  'Photo crop preview': 'කපන ලද ඡායාරූපයේ පෙරදසුන',
  Zoom: 'විශාලනය',
  'Horizontal position': 'තිරස් පිහිටීම',
  'Vertical position': 'සිරස් පිහිටීම',
  'Cancel photo': 'ඡායාරූපය අවලංගු කරන්න',
  'Remove custom photo': 'එක් කළ ඡායාරූපය ඉවත් කරන්න',
  'Sign out': 'පිටවන්න',
  'Table invitations': 'මේස ආරාධනා',
  'Share your friend code with people you know.':
    'ඔබ හඳුනන අයට පමණක් යහළු කේතය දෙන්න.',
  'Their friend code': 'ඔවුන්ගේ යහළු කේතය',
  'Send request': 'ඉල්ලීම යවන්න',
  'The friend action was unavailable. Check the code or try again.':
    'එම ක්‍රියාව කළ නොහැක. කේතය පරීක්ෂා කර නැවත උත්සාහ කරන්න.',
  'Updating friends…': 'යහළු ලැයිස්තුව යාවත්කාලීන කරමින්…',
  'No friends or requests yet.': 'තවම යහළුවන් හෝ ඉල්ලීම් නැත.',
  'Friend list': 'යහළු ලැයිස්තුව',
  'Request sent': 'ඉල්ලීම යැවීය',
  Accept: 'පිළිගන්න',
  Unblock: 'අවහිරය ඉවත් කරන්න',
  Block: 'අවහිර කරන්න',
  Connected: 'සම්බන්ධයි',
  Disconnected: 'සම්බන්ධතාව බිඳී ඇත',
  'Team scores': 'පිල්වල ලකුණු',
  'Game table': 'ක්‍රීඩා මේසය',
  'Last completed trick': 'අවසන් වූ පෙර අත',
  'Current trick': 'දැන් ක්‍රීඩා කරන අත',
  'No trump. Same dealer.': 'තුරුම්පු නැත. එම ක්‍රීඩකයාම යළි කොළ බෙදයි.',
  'Cut position': 'කපන තැන',
  'Cut & deal': 'කපා කොළ බෙදන්න',
  'Choose a suit from your first four cards.':
    'මුල් කොළ හතරෙන් වර්ගයක් තෝරන්න.',
  'Play selected card': 'තෝරාගත් කොළය ගසන්න',
  'Reconnecting to your table…': 'ඔබේ මේසයට නැවත සම්බන්ධ වෙමින්…',
  'Choose your trump suit.': 'තුරුම්පු වර්ගය තෝරන්න.',
  'Players on both teams reached the reconnection deadline together.':
    'පිල් දෙකේම ක්‍රීඩකයන්ගේ නැවත සම්බන්ධ වීමේ කාලය එකවර අවසන් විය.',
  'A ranked player’s reconnection period expired.':
    'ශ්‍රේණිගත ක්‍රීඩකයෙකුගේ නැවත සම්බන්ධ වීමේ කාලය අවසන් විය.',
  'The losing team couldn’t cover the kata kola transfer.':
    'පැරදුණු පිලට අවශ්‍ය කැට කොළ ගෙවීමට නොහැකි විය.',
  'සෙපෝරු · Four tricks each. Sepuru applies to the next settlement.':
    'සෙපෝරු · දෙපිලම අත් හතර බැගින් ගත්තා. සෙපෝරු ඊළඟ ගණනයට අදාළයි.',
  'කපෝති · All eight tricks. Three kata kola owed.':
    'කපෝති · අත් අටම දිනා කැට කොළ තුනක් ලැබේ.',
  'බාල්දුයි · Correct accusation. The hand ends with a three kata kola obligation.':
    'බාල්දුයි · පැමිණිල්ල නිවැරදියි. කැට කොළ තුනක වගකීමක් සමඟ අත අවසන්.',
  'All four players must reconnect before the next round.':
    'ඊළඟ වටයට පෙර ක්‍රීඩකයන් හතර දෙනාම නැවත සම්බන්ධ විය යුතුයි.',
  'The host can start the next round when all four players are connected.':
    'ක්‍රීඩකයන් හතර දෙනාම සම්බන්ධ වූ පසු මේසය සාදන්නාට ඊළඟ වටය ඇරඹිය හැක.',
  'Report an opponent’s play after its trick finishes and before the round ends.':
    'අත අවසන් වූ පසු වටය අවසන් වීමට පෙර විරුද්ධ පිලේ ගැසීමක් වාර්තා කරන්න.',
  'Protected play': 'ආරක්ෂිත ක්‍රීඩාව',
  'Protected play is on.': 'ආරක්ෂිත ක්‍රීඩාව සක්‍රියයි.',
  'Enable protected play': 'ආරක්ෂිත ක්‍රීඩාව සක්‍රිය කරන්න',
  'Confirm protected play (cannot be turned off here)':
    'තහවුරු කරන්න (මෙතැනින් අක්‍රිය කළ නොහැක)',
  'Protected play turns off chat, voice, invitations, and sponsor messages for this account.':
    'ආරක්ෂිත ක්‍රීඩාවේදී මෙම ගිණුමේ කතාබස්, හඬ, ආරාධනා සහ අනුග්‍රාහක පණිවිඩ අක්‍රිය වේ.',
  'Active restriction': 'සක්‍රිය සීමාව',
  'Restore communication': 'සන්නිවේදනය යළි සක්‍රිය කරන්න',
  'Restrict communication': 'සන්නිවේදනය සීමා කරන්න',
  'A SRI LANKAN TRADITION': 'ශ්\u200dරී ලාංකික සම්ප්\u200dරදායක්',
  'A familiar game. A little friendly rivalry.':
    'හුරුපුරුදු ක්\u200dරීඩාවක්. මිත්\u200dරශීලී තරගයක්.',
  'Good company, wherever you are.': 'කොතැන සිටියත් යහළුවන් සමඟ.',
  '4 players': 'ක්\u200dරීඩකයන් 4යි',
  '2 teams': 'පිල් 2යි',
  'Your kind of company': 'ඔබේ යහළුවන් සමඟ',
  'Sign-in is unavailable. Refresh the page to try again.':
    'පිවිසීමට නොහැකි විය. පිටුව යළි පූරණය කර උත්සාහ කරන්න.',
  'Your profile changed elsewhere. Review it before saving again.':
    'ඔබේ පැතිකඩ වෙනත් තැනක වෙනස් වී ඇත. යළි සුරැකීමට පෙර එය බලන්න.',
  'Choose a valid JPEG, PNG or WebP image, then adjust the crop.':
    'වලංගු JPEG, PNG හෝ WebP රූපයක් තෝරා කැපීම සකසන්න.',
  'Choose an image smaller than 4 MB.': '4 MB ට වඩා කුඩා රූපයක් තෝරන්න.',
  'Photo uploads are busy. Please try again in a moment.':
    'ඡායාරූප උඩුගත කිරීම කාර්යබහුලයි. මොහොතකින් යළි උත්සාහ කරන්න.',
  'Your sign-in needs refreshing. Close this panel and sign in again.':
    'මෙම කවුළුව වසා යළි පිවිසෙන්න.',
  'Could not save your profile. Please try again.':
    'පැතිකඩ සුරැකිය නොහැකි විය. යළි උත්සාහ කරන්න.',
  'Report a player': 'ක්‍රීඩකයෙකු වාර්තා කරන්න',
  'Who are you worried about?': 'ඔබට ගැටලුවක් ඇති කළේ කවුද?',
  'Choose a player': 'ක්‍රීඩකයෙකු තෝරන්න',
  'What happened?': 'සිදු වූයේ කුමක්ද?',
  'Unfriendly behavior': 'අමිත්‍රශීලී හැසිරීම',
  'Something felt unsafe': 'අනාරක්ෂිත බවක් දැනුණා',
  'Something else': 'වෙනත් හේතුවක්',
  'Send private report': 'පෞද්ගලික වාර්තාව යවන්න',
  'Your report was sent privately.': 'ඔබේ වාර්තාව පෞද්ගලිකව යවා ඇත.',
  'Could not send your report. Try again later.':
    'වාර්තාව යැවීමට නොහැකි විය. පසුව නැවත උත්සාහ කරන්න.',
  'Your seat is saved. You can return to this table.':
    'ඔබේ අසුන වෙන් කර ඇත. මෙම මේසයට ආපසු යා හැක.',
  'Back to profile': 'පැතිකඩට ආපසු',
  'Play OMI': 'ඕමි ක්‍රීඩා කරන්න',
  'Edit avatar': 'පැතිකඩ රූපය වෙනස් කරන්න',
  'Game menu': 'ක්‍රීඩා මෙනුව',
  'Profile & friends': 'පැතිකඩ සහ යහළුවෝ',
  'Settings & install': 'සැකසුම් සහ ස්ථාපනය',
  'Sound, voice & music': 'ශබ්ද, හඬ සහ සංගීතය',
  'Leaving a ranked game starts the reconnect timer. If it expires, your team forfeits.':
    'ශ්‍රේණිගත තරගයෙන් පිටවූ විට නැවත එක්වීමට කාලය ගණන් ගැනේ. කාලය අවසන් වුවහොත් ඔබේ පිල පරදියි.',
  'You have a saved seat. Return to your table and finish or leave the match before taking another seat.':
    'ඔබට වෙන් කළ අසුනක් තිබේ. වෙනත් අසුනක් ගැනීමට පෙර එම මේසයට ආපසු ගොස් තරගය අවසන් කරන්න හෝ තරගයෙන් ඉවත් වන්න.',
  'Share → Add to Home Screen → Add':
    'බෙදාගන්න → මුල් තිරයට එක් කරන්න → එක් කරන්න',
  'Open OMI in Safari, then follow these steps.':
    'Safari හි ඕමි විවෘත කර මෙම පියවර අනුගමනය කරන්න.',
  'This browser does not offer an install prompt. Check its menu for installation options.':
    'මෙම බ්‍රවුසරයෙන් ස්ථාපන ඉල්ලීමක් නොපෙන්වයි. එහි මෙනුවේ ස්ථාපන විකල්ප බලන්න.',
  'Voice and shared music are unavailable at this table.':
    'මෙම මේසයේ හඬ සහ හවුල් සංගීතය ලබා ගත නොහැක.',
  'Tropical Adventure': 'නිවර්තන වික්‍රමය',
  'Resume table': 'මේසයට යළි එක්වන්න',
  'Enter the code shared by your table host.':
    'මේසය සෑදූ ක්‍රීඩකයා දුන් කේතය ඇතුළත් කරන්න.',
  'Start a private table and invite three friends.':
    'පෞද්ගලික මේසයක් සාදා යහළුවන් තුන්දෙනෙකුට ආරාධනා කරන්න.',
  'Playing as': 'ක්‍රීඩක නම',
  'An eight-character table code': 'අක්ෂර අටක මේස කේතයක්',
  'Finding your seat…': 'ඔබේ අසුන සොයමින්…',
  Settings: 'සැකසුම්',
} as const;

export function translate(language: 'en' | 'si', message: string): string {
  return language === 'si' && Object.hasOwn(sinhala, message)
    ? sinhala[message as keyof typeof sinhala]
    : message;
}

export function useCopy() {
  const language = useLocale((state) => state.language);
  return (message: keyof typeof sinhala) => translate(language, message);
}
