import { useVideoCallContext } from '../context/VideoContext';

/**
 * Custom hook to easily consume VideoContext in visual components
 */
export function useVideoCall() {
  return useVideoCallContext();
}
