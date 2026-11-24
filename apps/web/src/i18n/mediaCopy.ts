import { useLocale } from './locale';

const sinhala = {
  'Room voice': 'මේසයේ හඬ කතාබස්',
  'At the table · Voice': 'මේසයේ හඬ කතාබස්',
  'Microphone off': 'මයික්\u200dරෆෝනය අක්\u200dරියයි',
  'Connecting voice…': 'හඬ සම්බන්ධ කරමින්…',
  'Reconnecting voice…': 'හඬ යළි සම්බන්ධ කරමින්…',
  'Voice connected': 'හඬ සම්බන්ධයි',
  'Voice unavailable': 'හඬ පහසුකම ලබා ගත නොහැක',
  'Join voice': 'හඬ කතාබසට එක් වන්න',
  'Unmute microphone': 'මයික්\u200dරෆෝනය සක්\u200dරිය කරන්න',
  'Mute microphone': 'මයික්\u200dරෆෝනය නිහඬ කරන්න',
  'Leave voice': 'හඬ කතාබසෙන් ඉවත් වන්න',
  'Enable voice playback': 'හඬ අසන්න',
  You: 'ඔබ',
  Muted: 'නිහඬයි',
  Speaking: 'කතා කරයි',
  Listening: 'සවන් දෙයි',
  Player: 'ක්\u200dරීඩකයා',
  Blocked: 'අවහිර කර ඇත',
  Connecting: 'සම්බන්ධ වෙමින්',
  'Volume for': 'හඬ මට්ටම',
  'Opt-in microphone. Audio is not recorded.':
    'මයික්\u200dරෆෝනය ඔබේ කැමැත්තෙන් සක්\u200dරිය කරන්න. හඬ පටිගත නොකෙරේ.',
  'Direct connections only; some networks need TURN.':
    'සෘජු සම්බන්ධතා පමණි. සමහර ජාලවලට TURN අවශ්\u200dයයි.',
  'Friends, chat & music': 'යහළුවෝ, කතාබස් සහ සංගීතය',
  'Shared music': 'හවුල් සංගීතය',
  'Loading music state…': 'සංගීතය පූරණය කරමින්…',
  Playing: 'වාදනය වෙමින්',
  Paused: 'නවතා ඇත',
  'Disable music locally': 'මගේ සංගීතය අක්\u200dරිය කරන්න',
  'Enable music locally': 'මට සංගීතය අසන්න',
  'Music volume': 'සංගීත ශබ්ද මට්ටම',
  'Shared track': 'හවුල් ගීතය',
  'Pause shared music': 'හවුල් සංගීතය නවතන්න',
  'Play shared music': 'හවුල් සංගීතය වාදනය කරන්න',
  'Shared playback position': 'හවුල් වාදන ස්ථානය',
  'Set shared position': 'වාදන ස්ථානය සකසන්න',
} as const;

export function useMediaCopy() {
  const language = useLocale((state) => state.language);
  return (key: keyof typeof sinhala) =>
    language === 'si' ? sinhala[key] : key;
}
