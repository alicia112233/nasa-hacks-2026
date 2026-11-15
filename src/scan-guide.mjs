const positioning = {
  'Step back': { id: 'step-back', title: 'Step back', detail: 'Your whole body and feet need to be in view.' },
  'Stand straight': { id: 'stand-straight', title: 'Stand straight', detail: 'Face the camera. Keep your body upright.' },
  'Arms out a little': { id: 'arms-out', title: 'Arms a little out', detail: 'Keep your arms straight, with a gap at your sides.' },
  'Arms lower': { id: 'arms-lower', title: 'Lower your arms', detail: 'Keep a small gap between your arms and body.' },
};

/**
 * One instruction for the screen and its matching bundled spoken prompt.
 * @param {{ status: string, issue?: string | null, remaining?: number, needsHeight?: boolean, error?: boolean }} options
 */
export function scanGuidance({ status, issue = null, remaining = 5, needsHeight = false, error = false }) {
  if (status === 'done') return { id: 'complete', title: 'Scan complete', detail: 'Come back to the device to review your scan.', repeat: false };
  if (needsHeight) return { id: 'height', title: 'Add your height first', detail: 'Crew menu → Edit profile → Height. Then return to the leg check.', repeat: false };
  if (status === 'intro') return { id: 'camera-error', title: 'Check camera access', detail: 'Come back to the device, check the message below and try again.', repeat: false };
  if (status === 'loading') return { id: 'prepare', title: 'Starting camera', detail: 'Allow camera access if asked. Then step back until your feet show.', repeat: false };
  if (error) return { id: 'retry', title: 'Let’s try again', detail: 'Step back, arms a little out. Keep your whole body in view.', repeat: true };
  if (issue && positioning[issue]) return { ...positioning[issue], repeat: true };
  if (status === 'scanning') {
    const count = Math.max(0, Math.ceil(remaining));
    if (!count) return { id: 'more-frames', title: 'Keep still', detail: 'Collecting more clear frames. The scan will finish automatically.', repeat: false };
    return { id: ({ 3: 'three', 2: 'two', 1: 'one' })[count] ?? 'scanning', title: 'Hold still', detail: 'Scanning. Stay in this position.', count, repeat: false };
  }
  return { id: 'ready', title: 'Stay there', detail: 'Body in view. Your scan starts automatically.', repeat: false };
}
