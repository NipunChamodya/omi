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

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [sinhala, setSinhala] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const lesson = lessons[index]!;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const finish = index === lessons.length - 1;
  return (
    <dialog
      ref={dialog}
      className="profile-dialog"
      lang={sinhala ? 'si' : 'en'}
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
          {sinhala ? 'ආපසු' : 'Back'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => setSinhala(!sinhala)}
          lang={sinhala ? 'en' : 'si'}
        >
          {sinhala ? 'English' : 'සිංහල'}
        </button>
        <h2 id="tutorial-title">{sinhala ? 'ඕමි පුහුණුව' : 'Practice OMI'}</h2>
        <p>
          {index + 1} / {lessons.length}
        </p>
        <p>{lesson[sinhala ? 1 : 0]}</p>
        {[0, 1].map((answer) => {
          const right = answer === index % 2;
          const label = lesson[(right ? 2 : 4) + Number(sinhala)];
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
          {correct === null
            ? ''
            : correct
              ? sinhala
                ? 'හරි!'
                : 'Correct!'
              : sinhala
                ? 'නැවත උත්සාහ කරන්න.'
                : 'Try again.'}
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
          {finish
            ? sinhala
              ? 'අවසන් කරන්න'
              : 'Finish'
            : sinhala
              ? 'ඊළඟට'
              : 'Next'}
        </button>
      </div>
    </dialog>
  );
}
