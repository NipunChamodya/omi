const maxBytes = 25 * 1024 * 1024;
const acceptedTypes: Record<string, readonly string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  aac: ['audio/aac', 'audio/x-aac', 'audio/aacp'],
  m4a: ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'video/mp4'],
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'],
};

export function canSelectLocalMusic(
  file: Pick<File, 'name' | 'size' | 'type'>,
) {
  if (file.size <= 0 || file.size > maxBytes) return false;
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (!extension || !Object.hasOwn(acceptedTypes, extension)) return false;
  return (
    !file.type ||
    file.type === 'application/octet-stream' ||
    acceptedTypes[extension]!.includes(file.type.toLowerCase())
  );
}

export function fitsLocalMusicBudget(
  buffer: Pick<AudioBuffer, 'duration' | 'length' | 'numberOfChannels'>,
) {
  return (
    buffer.duration > 0 &&
    buffer.duration <= 1200 &&
    buffer.numberOfChannels <= 2 &&
    buffer.length * buffer.numberOfChannels <= 30_000_000
  );
}
