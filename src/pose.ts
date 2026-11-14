import type { PoseLandmarker } from '@mediapipe/tasks-vision';

/** Front camera, no audio. Browsers allow it on localhost or HTTPS only. */
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost or a secure HTTPS connection.');
  return navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
}

/** The bundled MediaPipe Pose Landmarker (lite), run on the CPU from local files, so it works offline. */
export async function loadPose(options: { segmentation?: boolean; mode?: 'VIDEO' | 'IMAGE' } = {}): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks('/wasm');
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'CPU' },
    runningMode: options.mode ?? 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .6, minTrackingConfidence: .6,
    outputSegmentationMasks: !!options.segmentation,
  });
}

export function cameraMessage(err: unknown, task: string) {
  const message = err instanceof Error ? err.message : String(err);
  return /denied|Permission|NotAllowed/i.test(message) ? 'Camera permission was declined. Allow camera access in your browser and try again.' : `Could not start ${task}. ${message}`;
}
