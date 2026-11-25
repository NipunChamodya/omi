import './adventure-surfaces.css';
import { GameRibbon } from './GameChrome';
import { useLocale, type Language } from '../i18n/locale';
import { useEffect, useRef, useState } from 'react';

const lessons = [
  [
    'Who is your partner?',
    'ඔබේ සහකරු කවුද?',
    'The player opposite you',
    'ඔබට ඉදිරියෙන් සිටින ක්‍රීඩකයා',
    'The player beside you',
    'ඔබ ළඟ සිටින ක්‍රීඩකයා',
  ],
  [
    'Which rank is highest in a suit?',
    'එකම වර්ගයේ ඉහළම කොළය කුමක්ද?',
    'Ace (A)',
    'ආසියා (A)',
    'King (K)',
    'රජා (K)',
  ],
  [
    'Which way do turns move?',
    'වාරය යන්නේ කුමන දිශාවටද?',
    'Counterclockwise',
    'ඔරලෝසුවට විරුද්ධ දිශාවට',
    'Clockwise',
    'ඔරලෝසුවේ දිශාවට',
  ],
  [
    'How many cards do you get before choosing trump?',
    'තුරුම්පු තෝරන්න කලින් ලැබෙන කොළ ගණන කීයද?',
    'Four',
    'හතරයි',
    'Eight',
    'අටයි',
  ],
  [
    'Your first four cards are A♣, 10♣, Q♦ and J♦. Which suit can you choose as trump?',
    'මුල් කොළ හතර A♣, 10♣, Q♦ සහ J♦. තුරුම්පු ලෙස තෝරාගත හැක්කේ කුමක්ද?',
    'Clubs ♣',
    'කලාබර ♣',
    'Hearts ♥',
    'හාරත ♥',
  ],
  [
    'A heart leads and you hold 7♥ and A♣. Which follows suit?',
    'හාරත කොළයකින් පටන් ගත් විට ඔබ ළඟ 7♥ සහ A♣ තිබේ නම් වර්ගයට ගැළපෙන්නේ කුමක්ද?',
    '7♥',
    '7♥',
    'A♣',
    'A♣',
  ],
  [
    'Clubs lead and hearts are trump. Which wins, A♣ or 7♥?',
    'කලාබර මුලට ගැසූ විට හාරත තුරුම්පු නම් දිනන්නේ A♣ ද, 7♥ ද?',
    '7♥',
    '7♥',
    'A♣',
    'A♣',
  ],
  [
    'How many kata kola does each team start with?',
    'එක් කණ්ඩායමක් කැට කොල කීයකින් පටන් ගන්නවාද?',
    'Ten',
    'දහයයි',
    'Eight',
    'අටයි',
  ],
  [
    'What is a four-trick tie called?',
    'අත් හතර බැගින් ලැබෙන සම තත්ත්වයට කියන්නේ කුමක්ද?',
    'Sepuru',
    'සෙපෝරු',
    'Kapothi',
    'කපෝති',
  ],
  [
    'What does an eight-trick Kapothi require the losing team to pay?',
    'අත් අටම දිනන කපෝතියකදී පැරදුණු පිල දිය යුතු කැට කොල ගණන කීයද?',
    'Three kata kola',
    'කැට කොල තුනයි',
    'One kata kola',
    'එක කැට කොලයයි',
  ],
  [
    'When can you report an opponent’s Baldu?',
    'විරුද්ධ පිලේ බාල්දුවක් වාර්තා කළ හැක්කේ කවදාද?',
    'After that trick finishes, before the round ends',
    'ඒ අත අවසන් වූ පසු, වටය අවසන් වීමට පෙර',
    'Before that trick finishes',
    'ඒ අත අවසන් වීමට පෙර',
  ],
  [
    'How many of the other players must approve an eligible no-trump redeal?',
    'තුරුම්පු නැති අතක් නැවත බෙදීමට අනෙක් ක්‍රීඩකයන් කී දෙනෙක් එකඟ විය යුතුද?',
    'Two of three',
    'තුන් දෙනාගෙන් දෙදෙනෙක්',
    'Only one',
    'එක් අයෙක් පමණයි',
  ],
  [
    'A team owes three kata kola and holds only two. What happens?',
    'කණ්ඩායමක් කැට කොල තුනක් දිය යුතු නමුත් ළඟ දෙකක් පමණක් තිබේ. සිදුවන්නේ කුමක්ද?',
    'That team loses the match',
    'ඒ කණ්ඩායම තරගයෙන් පරදිනවා',
    'The next hand starts normally',
    'ඊළඟ අත සාමාන්‍ය ලෙස පටන් ගන්නවා',
  ],
] as const;

const tamilLessons = [
  [
    'உங்கள் அணித் தோழர் யார்?',
    'உங்களுக்கு எதிரே உள்ள வீரர்',
    'உங்களுக்கு அருகில் உள்ள வீரர்',
  ],
  ['ஒரே வகையில் உயர்ந்த சீட்டு எது?', 'ஏஸ் (A)', 'ராஜா (K)'],
  ['விளையாட்டு முறை எந்தத் திசையில் செல்கிறது?', 'இடஞ்சுழியாக', 'வலஞ்சுழியாக'],
  [
    'துருப்பைத் தேர்ந்தெடுக்குமுன் எத்தனை சீட்டுகள் கிடைக்கும்?',
    'நான்கு',
    'எட்டு',
  ],
  [
    'முதல் நான்கு சீட்டுகள் A♣, 10♣, Q♦, J♦. எந்த வகையைத் துருப்பாகத் தேர்ந்தெடுக்கலாம்?',
    'கிளப் ♣',
    'ஹார்ட் ♥',
  ],
  [
    'முதலில் ஹார்ட் போடப்பட்டது. உங்களிடம் 7♥, A♣ உள்ளன. அதே வகையைச் சேர்ந்த சீட்டு எது?',
    '7♥',
    'A♣',
  ],
  [
    'முதலில் கிளப் போடப்பட்டது. ஹார்ட் துருப்பு. A♣, 7♥ இரண்டில் எது வெல்லும்?',
    '7♥',
    'A♣',
  ],
  ['ஒவ்வோர் அணியும் எத்தனை கட்ட கொலவுடன் தொடங்கும்?', 'பத்து', 'எட்டு'],
  [
    'இரு அணிகளும் நான்கு கைகள் வென்றால் அந்தச் சமநிலைக்கு என்ன பெயர்?',
    'செபுரு',
    'கபோதி',
  ],
  [
    'எட்டு கைகளையும் வென்ற கபோதியில் தோற்ற அணி எவ்வளவு கொடுக்க வேண்டும்?',
    'மூன்று கட்ட கொல',
    'ஒரு கட்ட கொல',
  ],
  [
    'எதிரணியின் பல்துவை எப்போது புகாரளிக்கலாம்?',
    'அந்தக் கை முடிந்த பின், சுற்று முடிவதற்கு முன்',
    'அந்தக் கை முடிவதற்கு முன்',
  ],
  [
    'தகுதியுள்ள துருப்பு இல்லாத கையை மீண்டும் பகிர மற்ற வீரர்களில் எத்தனை பேர் ஒப்புக்கொள்ள வேண்டும்?',
    'மூவரில் இருவர்',
    'ஒருவர் மட்டும்',
  ],
  [
    'ஒரு அணி மூன்று கட்ட கொல கொடுக்க வேண்டும், ஆனால் இரண்டே உள்ளன. என்ன நடக்கும்?',
    'அந்த அணி ஆட்டத்தில் தோற்கும்',
    'அடுத்த கை வழக்கம் போலத் தொடங்கும்',
  ],
] as const;

const tutorialCopy = {
  en: {
    title: 'Practice OMI',
    back: 'Back',
    correct: 'Correct!',
    retry: 'Try again.',
    finish: 'Finish',
    next: 'Next',
  },
  si: {
    title: 'ඕමි පුහුණුව',
    back: 'ආපසු',
    correct: 'හරි!',
    retry: 'නැවත උත්සාහ කරන්න.',
    finish: 'අවසන් කරන්න',
    next: 'ඊළඟට',
  },
  ta: {
    title: 'ஓமி பயிற்சி',
    back: 'பின்செல்',
    correct: 'சரி!',
    retry: 'மீண்டும் முயற்சி செய்.',
    finish: 'முடி',
    next: 'அடுத்து',
  },
};

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const preferred = useLocale((state) => state.language);
  const [language, setLanguage] = useState<Language>(preferred);
  const copy = tutorialCopy[language];
  const [correct, setCorrect] = useState<boolean | null>(null);
  const lesson = lessons[index]!;
  const strings =
    language === 'ta'
      ? tamilLessons[index]!
      : language === 'si'
        ? [lesson[1], lesson[3], lesson[5]]
        : [lesson[0], lesson[2], lesson[4]];
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const finish = index === lessons.length - 1;
  return (
    <dialog
      ref={dialog}
      className="profile-dialog tutorial-dialog"
      lang={language}
      aria-labelledby="tutorial-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="profile-inner">
        <button
          type="button"
          className="button game-back"
          onClick={() => {
            if (index === 0) onClose();
            else {
              setIndex(index - 1);
              setCorrect(null);
            }
          }}
        >
          {copy.back}
        </button>
        <div className="tutorial-languages">
          {(
            [
              ['en', 'English'],
              ['si', 'සිංහල'],
              ['ta', 'தமிழ்'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              className="text-button"
              key={value}
              lang={value}
              aria-pressed={language === value}
              onClick={() => setLanguage(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <GameRibbon id="tutorial-title">{copy.title}</GameRibbon>
        <p>
          {index + 1} / {lessons.length}
        </p>
        <p>{strings[0]}</p>
        {[0, 1].map((answer) => {
          const right = answer === index % 2;
          const label = strings[right ? 1 : 2];
          return (
            <button
              type="button"
              key={answer}
              className="button secondary"
              disabled={correct === true}
              onClick={() => setCorrect(right)}
            >
              {label}
            </button>
          );
        })}
        <p role="status">
          {correct === null ? '' : correct ? copy.correct : copy.retry}
        </p>
        <button
          type="button"
          className="button primary"
          disabled={correct !== true}
          onClick={() => {
            if (finish) onClose();
            else {
              setIndex(index + 1);
              setCorrect(null);
            }
          }}
        >
          {finish ? copy.finish : copy.next}
        </button>
      </div>
    </dialog>
  );
}
