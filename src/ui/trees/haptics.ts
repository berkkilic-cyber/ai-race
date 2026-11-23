import { lightHaptic as feelLight } from '../feel/haptics';

/** A light tap after a purchase. No-op on web or with haptics off; never throws (see src/ui/feel/haptics.ts). */
export function lightHaptic(): void {
  feelLight();
}
