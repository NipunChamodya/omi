import { changeSoundPreferences, useSoundPreferences } from './preferences';
import { gameAudio } from './gameAudio';
export function SoundSettings() {
  const prefs = useSoundPreferences();
  return (
    <details className="sound-settings" id="table-sound-settings">
      <summary>Sound &amp; motion</summary>
      <div className="sound-settings-body">
        <p>Quiet by default. Voice has its own volume.</p>
        {(
          [
            ['enabled', 'Master sound'],
            ['cards', 'Card sounds'],
            ['ui', 'UI sounds'],
            ['celebrations', 'Celebration sounds'],
            ['ambience', 'Quiet table ambience'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(event) => {
                changeSoundPreferences({ [key]: event.target.checked });
                void gameAudio.unlock();
              }}
            />
            {label}
          </label>
        ))}
        {(
          [
            ['volume', 'Sound effects volume'],
            ['voice', 'Voice chat volume'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={prefs[key]}
              onChange={(event) =>
                changeSoundPreferences({ [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <label>
          Shuffle duration
          <input
            type="range"
            min="400"
            max="1600"
            step="100"
            value={prefs.motionMs}
            onChange={(event) =>
              changeSoundPreferences({ motionMs: Number(event.target.value) })
            }
          />
          <output>{(prefs.motionMs / 1000).toFixed(1)} seconds</output>
        </label>
        <p>
          Reduced motion follows your device settings. Ambience is optional and
          stops when the tab is hidden.
        </p>
        <a href="#main">Back to table</a>
      </div>
    </details>
  );
}
