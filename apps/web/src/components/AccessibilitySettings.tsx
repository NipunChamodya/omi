import { useCopy } from '../i18n/locale';

const storageKey = 'omi.high-contrast';

export function readHighContrast() {
  try {
    return localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

export function AccessibilitySettings({
  contrast,
  onChange,
}: {
  contrast: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const text = useCopy();
  return (
    <label className="contrast-option">
      <input
        type="checkbox"
        checked={contrast}
        onChange={(event) => {
          const enabled = event.currentTarget.checked;
          onChange(enabled);
          try {
            localStorage.setItem(storageKey, String(enabled));
          } catch {
            // The preference is still available for this session.
          }
        }}
      />
      {text('High contrast')}
    </label>
  );
}
