import { useLocale } from './locale';

const sinhala = {
  'File audio could not connect or play.':
    'ගොනු හඬ සම්බන්ධ කිරීමට හෝ වාදනය කිරීමට නොහැකි විය.',
  'Choose an MP3, AAC, M4A or WAV file up to 25 MiB.':
    '25 MiB දක්වා MP3, AAC, M4A හෝ WAV ගොනුවක් තෝරන්න.',
  'Waiting for the host to share': 'සත්කාරකයා බෙදා ගන්නා තුරු බලා සිටියි',
  'File audio connected': 'ගොනු හඬ සම්බන්ධයි',
  'File sharing connected': 'ගොනුව බෙදා ගැනීම සම්බන්ධයි',
  'File audio off': 'ගොනු හඬ අක්‍රියයි',
  'Mute file music': 'ගොනු සංගීතය නිහඬ කරන්න',
  'File music volume': 'ගොනු සංගීතයේ හඬ මට්ටම',
  'Enable file audio playback': 'ගොනු හඬ සක්‍රිය කරන්න',
  'Listen to shared file': 'බෙදාගත් ගොනුව අසන්න',
  'Leave file audio': 'ගොනු හඬෙන් ඉවත් වන්න',
  'File playback position': 'ගොනුවේ වාදන ස්ථානය',
  'Stop file sharing': 'ගොනුව බෙදා ගැනීම නවතන්න',
  'Play file': 'ගොනුව වාදනය කරන්න',
  'Pause file': 'ගොනුව මඳකට නවතන්න',
  'Start sharing file': 'ගොනුව බෙදා ගැනීම අරඹන්න',
  'I have permission to share this audio.': 'මෙම හඬ බෙදා ගැනීමට මට අවසර ඇත.',
  'Choose a music file': 'සංගීත ගොනුවක් තෝරන්න',
  'The table host can share music from their device.':
    'මේසයේ සත්කාරකයාට තම උපාංගයෙන් සංගීතය බෙදා ගත හැකිය.',
  'Local table music': 'උපාංගයේ සංගීතය',
  'Push to talk': 'ඔබාගෙන කතා කරන්න',
  'Hold to talk': 'කතා කිරීමට ඔබාගෙන සිටින්න',
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
