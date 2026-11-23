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
} as const;

export function useCopy() {
  const language = useLocale((state) => state.language);
  return (message: keyof typeof sinhala) =>
    language === 'si' ? sinhala[message] : message;
}
