import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

// For this app we always use the dark/trader theme regardless of system setting
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
