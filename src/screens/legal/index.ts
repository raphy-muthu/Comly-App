/**
 * Legal screens. Registered in both PublicStack and AppStack so /terms and
 * /privacy resolve whether or not anyone is signed in.
 */

import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '@/legal/content';
import { makeLegalScreen } from './LegalDocumentScreen';

export const TermsScreen = makeLegalScreen(TERMS_OF_SERVICE);
export const PrivacyScreen = makeLegalScreen(PRIVACY_POLICY);

export { LegalDocumentScreen } from './LegalDocumentScreen';
