/**
 * Comly legal documents — single source of truth.
 *
 * The Terms of Service began as a Termly-generated document but has since been
 * edited to match the product. Changes from the generated original:
 *   - Removed PURCHASES AND PAYMENT, SUBSCRIPTIONS, and the no-refund POLICY
 *     section. Comly processes no money, has no subscriptions, and does not
 *     accept cards; leaving those in meant users were agreeing to terms about
 *     a payment system that does not exist. Sections renumbered accordingly.
 *   - Added "Our role, and payment between users" under §1, which is what
 *     those deleted sections should have said in the first place.
 *   - Scoped the "non-commercial use" language in §2 and the
 *     "revenue-generating endeavor" prohibition in §5, which together banned
 *     the exact activity the app exists for (helpers being paid for work).
 *   - Dropped the self-contradicting opener in §6 ("The Services does not
 *     offer users to submit or post content" — it does).
 *
 * Two known gaps, both needing counsel rather than an engineer:
 *   1. No child-labor-law clause. Given the product puts minors into paid work,
 *      this is the most conspicuous omission. It would slot into §5 or as its
 *      own section after §1.
 *   2. No legal entity is named — the document identifies two individuals, so
 *      there is no corporate shield behind the liability and indemnity clauses.
 *
 * Rendered natively by LegalDocumentScreen (mobile + Expo web) and exported to
 * standalone pages under web/legal/ by scripts/build-legal-html.mjs, so the
 * app and the hosted URLs can never drift apart.
 */

export type LegalBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'li'; text: string };

export interface LegalDocument {
  title: string;
  /** Human-readable date shown under the title. */
  lastUpdated: string;
  /** Machine version recorded against a user's consent. */
  version: string;
  blocks: LegalBlock[];
  /** Rendered as a footnote; Termly requires attribution on generated docs. */
  attribution?: { text: string; linkLabel: string; url: string };
}

/**
 * Consent versions stored on the profile at sign-up.
 *
 * Bump these whenever the corresponding document changes materially — the
 * stored value is what tells you which text a given user actually agreed to,
 * and re-consent is driven by comparing these against `terms_version` /
 * `privacy_version` on the profile.
 */
export const TERMS_VERSION = '2026-09-06';
export const PRIVACY_VERSION = '2026-09-06';

/**
 * Public origin the legal pages are hosted under. Also a deep-link prefix, so
 * following https://comly.app/terms on a device with the app installed opens
 * the in-app screen instead of the browser.
 *
 * TODO(launch): point this at the real domain once the pages are deployed, and
 * update the URLs in App Store Connect / Play Console to match.
 */
export const LEGAL_ORIGIN = 'https://comly.app';

/** Public URLs for the hosted copies. Also used by the store listings. */
export const LEGAL_URLS = {
  terms: `${LEGAL_ORIGIN}/terms`,
  privacy: `${LEGAL_ORIGIN}/privacy`,
} as const;

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: 'September 06, 2026',
  version: TERMS_VERSION,
  blocks: [
    { type: 'h2', text: `AGREEMENT TO OUR LEGAL TERMS` },
    {
      type: 'p',
      text: `We are Comly ("Company," "we," "us," or "our"), operated by co-founders Raphael Muthu and Marcel Afsar, and based in Philadelphia, Pennsylvania, United States.`,
    },
    {
      type: 'p',
      text: `We operate the mobile application Comly (the "App"), as well as any other related products and services that refer or link to these legal terms (the "Legal Terms") (collectively, the "Services").`,
    },
    {
      type: 'p',
      text: `Comly is a local neighborhood help marketplace that connects residents who need help with small tasks to trusted local helpers. Users can post service listings, apply for local jobs, review profiles, and use safety features like parent approval, ratings, reporting, and task safety labels.`,
    },
    {
      type: 'p',
      text: `You can contact us by email at raphaelmuthu21@gmail.com or marceldonk777@gmail.com, or by mail at [MAILING ADDRESS TO BE PROVIDED], Philadelphia, Pennsylvania [ZIP CODE], United States.`,
    },
    {
      type: 'p',
      text: `These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you"), and Comly, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.`,
    },
    {
      type: 'p',
      text: `The Services are intended for users who are at least 13 years of age. All users who are minors in the jurisdiction in which they reside (generally under the age of 18) must have the permission of, and be directly supervised by, their parent or guardian to use the Services. If you are a minor, you must have your parent or guardian read and agree to these Legal Terms prior to you using the Services.`,
    },
    {
      type: 'p',
      text: `We recommend that you print a copy of these Legal Terms for your records.`,
    },

    { type: 'h2', text: `1. OUR SERVICES` },
    {
      type: 'p',
      text: `The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.`,
    },
    {
      type: 'p',
      text: `The Services are not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use the Services. You may not use the Services in a way that would violate the Gramm-Leach-Bliley Act (GLBA).`,
    },
    { type: 'h3', text: `Our role, and payment between users` },
    {
      type: 'p',
      text: `Comly is a venue that connects users with one another. We are not a party to any agreement reached between a customer and a helper, we do not supervise or direct the performance of any job, and we do not employ helpers.`,
    },
    {
      type: 'p',
      text: `We do not process, hold, collect, or transfer payment of any kind between users, and we take no commission or fee from any job. Any pay rate, range, or wage guideline shown in the Services is a non-binding suggestion offered for information only. The amount, method, and timing of payment are agreed and settled directly between the users involved.`,
    },
    {
      type: 'p',
      text: `Because we are not a party to those arrangements, we are not responsible for non-payment, underpayment, the quality or completion of any job, or any other aspect of the agreement between users. Any such dispute must be resolved between the users themselves.`,
    },

    { type: 'h2', text: `2. INTELLECTUAL PROPERTY RIGHTS` },
    { type: 'h3', text: `Our intellectual property` },
    {
      type: 'p',
      text: `We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos contained therein (the "Marks").`,
    },
    {
      type: 'p',
      text: `Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world.`,
    },
    {
      type: 'p',
      text: `The Content and Marks are provided in or through the Services "AS IS" for your personal, non-commercial use only.`,
    },
    { type: 'h3', text: `Your use of our Services` },
    {
      type: 'p',
      text: `Subject to your compliance with these Legal Terms, including the "PROHIBITED ACTIVITIES" section below, we grant you a non-exclusive, non-transferable, revocable license to:`,
    },
    { type: 'li', text: `access the Services; and` },
    {
      type: 'li',
      text: `download or print a copy of any portion of the Content to which you have properly gained access,`,
    },
    { type: 'p', text: `solely for your personal, non-commercial use.` },
    {
      type: 'p',
      text: `For clarity, "non-commercial use" in this section refers to our Content and Marks — our software, designs, branding, and other materials. It does not restrict use of the Services for their intended purpose: posting jobs, applying for jobs, and being paid by another user for work you complete through the Services.`,
    },
    {
      type: 'p',
      text: `Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.`,
    },
    {
      type: 'p',
      text: `If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: raphaelmuthu21@gmail.com or marceldonk777@gmail.com. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.`,
    },
    {
      type: 'p',
      text: `We reserve all rights not expressly granted to you in and to the Services, Content, and Marks.`,
    },
    {
      type: 'p',
      text: `Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.`,
    },
    { type: 'h3', text: `Your submissions` },
    {
      type: 'p',
      text: `Please review this section and the "PROHIBITED ACTIVITIES" section carefully prior to using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.`,
    },
    {
      type: 'p',
      text: `Submissions: By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services ("Submissions"), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.`,
    },
    {
      type: 'p',
      text: `You are responsible for what you post or upload: By sending us Submissions through any part of the Services you:`,
    },
    {
      type: 'li',
      text: `confirm that you have read and agree with our "PROHIBITED ACTIVITIES" and will not post, send, publish, upload, or transmit through the Services any Submission that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;`,
    },
    {
      type: 'li',
      text: `to the extent permissible by applicable law, waive any and all moral rights to any such Submission;`,
    },
    {
      type: 'li',
      text: `warrant that any such Submission are original to you or that you have the necessary rights and licenses to submit such Submissions and that you have full authority to grant us the above-mentioned rights in relation to your Submissions; and`,
    },
    {
      type: 'li',
      text: `warrant and represent that your Submissions do not constitute confidential information.`,
    },
    {
      type: 'p',
      text: `You are solely responsible for your Submissions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party’s intellectual property rights, or (c) applicable law.`,
    },

    { type: 'h2', text: `3. USER REPRESENTATIONS` },
    {
      type: 'p',
      text: `By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Legal Terms; (4) you are not under the age of 13; (5) you are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services; (6) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (7) you will not use the Services for any illegal or unauthorized purpose; and (8) your use of the Services will not violate any applicable law or regulation.`,
    },
    {
      type: 'p',
      text: `If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any and all current or future use of the Services (or any portion thereof).`,
    },

    { type: 'h2', text: `4. USER REGISTRATION` },
    {
      type: 'p',
      text: `You may be required to register to use the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.`,
    },

    { type: 'h2', text: `5. PROHIBITED ACTIVITIES` },
    {
      type: 'p',
      text: `You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.`,
    },
    { type: 'p', text: `As a user of the Services, you agree not to:` },
    {
      type: 'li',
      text: `Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.`,
    },
    {
      type: 'li',
      text: `Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.`,
    },
    {
      type: 'li',
      text: `Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein.`,
    },
    {
      type: 'li',
      text: `Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.`,
    },
    {
      type: 'li',
      text: `Use any information obtained from the Services in order to harass, abuse, or harm another person.`,
    },
    {
      type: 'li',
      text: `Make improper use of our support services or submit false reports of abuse or misconduct.`,
    },
    {
      type: 'li',
      text: `Use the Services in a manner inconsistent with any applicable laws or regulations.`,
    },
    { type: 'li', text: `Engage in unauthorized framing of or linking to the Services.` },
    {
      type: 'li',
      text: `Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party’s uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.`,
    },
    {
      type: 'li',
      text: `Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.`,
    },
    {
      type: 'li',
      text: `Delete the copyright or other proprietary rights notice from any Content.`,
    },
    {
      type: 'li',
      text: `Attempt to impersonate another user or person or use the username of another user.`,
    },
    {
      type: 'li',
      text: `Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats ("gifs"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as "spyware" or "passive collection mechanisms" or "pcms").`,
    },
    {
      type: 'li',
      text: `Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.`,
    },
    {
      type: 'li',
      text: `Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.`,
    },
    {
      type: 'li',
      text: `Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.`,
    },
    {
      type: 'li',
      text: `Copy or adapt the Services' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.`,
    },
    {
      type: 'li',
      text: `Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.`,
    },
    {
      type: 'li',
      text: `Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.`,
    },
    {
      type: 'li',
      text: `Use a buying agent or purchasing agent to make purchases on the Services.`,
    },
    {
      type: 'li',
      text: `Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.`,
    },
    {
      type: 'li',
      text: `Use the Services as part of any effort to compete with us. This does not restrict posting jobs, applying for jobs, or being paid by another user for work completed through the Services, which is what the Services are for.`,
    },
    { type: 'li', text: `Sell or otherwise transfer your profile.` },
    {
      type: 'li',
      text: `Users may not post, request, offer, or accept tasks that are illegal, unsafe, exploitative, discriminatory, or inappropriate for minors.`,
    },
    {
      type: 'li',
      text: `Users may not post or accept tasks involving weapons, alcohol, tobacco or vaping products, drugs, gambling, adult services, hazardous chemicals, dangerous heights, heavy machinery, electrical work, or other unsafe conditions.`,
    },
    {
      type: 'li',
      text: `Users may not bypass parent or guardian approval requirements, misrepresent their age, impersonate another person, or create fake profiles.`,
    },
    {
      type: 'li',
      text: `Users may not harass, threaten, discriminate against, scam, exploit, or pressure other users.`,
    },
    {
      type: 'li',
      text: `Users may not share private contact information, exact addresses, or arrange unsafe off-platform contact before a job is accepted through Comly.`,
    },
    {
      type: 'li',
      text: `Users may not refuse agreed payment, request unpaid work, or use Comly to exploit helpers.`,
    },

    { type: 'h2', text: `6. USER GENERATED CONTRIBUTIONS` },
    {
      type: 'p',
      text: `The Services provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, "Contributions"). Contributions may be viewable by other users of the Services and through third-party websites. When you create or make available any Contributions, you thereby represent and warrant that:`,
    },
    {
      type: 'li',
      text: `The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.`,
    },
    {
      type: 'li',
      text: `You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.`,
    },
    {
      type: 'li',
      text: `You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.`,
    },
    { type: 'li', text: `Your Contributions are not false, inaccurate, or misleading.` },
    {
      type: 'li',
      text: `Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.`,
    },
    {
      type: 'li',
      text: `Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).`,
    },
    {
      type: 'li',
      text: `Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.`,
    },
    {
      type: 'li',
      text: `Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.`,
    },
    { type: 'li', text: `Your Contributions do not violate any applicable law, regulation, or rule.` },
    {
      type: 'li',
      text: `Your Contributions do not violate the privacy or publicity rights of any third party.`,
    },
    {
      type: 'li',
      text: `Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.`,
    },
    {
      type: 'li',
      text: `Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.`,
    },
    {
      type: 'li',
      text: `Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.`,
    },
    {
      type: 'p',
      text: `Any use of the Services in violation of the foregoing violates these Legal Terms and may result in, among other things, termination or suspension of your rights to use the Services.`,
    },

    { type: 'h2', text: `7. CONTRIBUTION LICENSE` },
    {
      type: 'p',
      text: `You and Services agree that we may access, store, process, and use any information and personal data that you provide and your choices (including settings).`,
    },
    {
      type: 'p',
      text: `By submitting suggestions or other feedback regarding the Services, you agree that we can use and share such feedback for any purpose without compensation to you.`,
    },
    {
      type: 'p',
      text: `We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area on the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.`,
    },

    { type: 'h2', text: `8. GUIDELINES FOR REVIEWS` },
    {
      type: 'p',
      text: `We may provide you areas on the Services to leave reviews or ratings. When posting a review, you must comply with the following criteria: (1) you should have firsthand experience with the person/entity being reviewed; (2) your reviews should not contain offensive profanity, or abusive, racist, offensive, or hateful language; (3) your reviews should not contain discriminatory references based on religion, race, gender, national origin, age, marital status, sexual orientation, or disability; (4) your reviews should not contain references to illegal activity; (5) you should not be affiliated with competitors if posting negative reviews; (6) you should not make any conclusions as to the legality of conduct; (7) you may not post any false or misleading statements; and (8) you may not organize a campaign encouraging others to post reviews, whether positive or negative.`,
    },
    {
      type: 'p',
      text: `We may accept, reject, or remove reviews in our sole discretion. We have absolutely no obligation to screen reviews or to delete reviews, even if anyone considers reviews objectionable or inaccurate. Reviews are not endorsed by us, and do not necessarily represent our opinions or the views of any of our affiliates or partners. We do not assume liability for any review or for any claims, liabilities, or losses resulting from any review. By posting a review, you hereby grant to us a perpetual, non-exclusive, worldwide, royalty-free, fully paid, assignable, and sublicensable right and license to reproduce, modify, translate, transmit by any means, display, perform, and/or distribute all content relating to review.`,
    },

    { type: 'h2', text: `9. MOBILE APPLICATION LICENSE` },
    { type: 'h3', text: `Use License` },
    {
      type: 'p',
      text: `If you access the Services via the App, then we grant you a revocable, non-exclusive, non-transferable, limited right to install and use the App on wireless electronic devices owned or controlled by you, and to access and use the App on such devices strictly in accordance with the terms and conditions of this mobile application license contained in these Legal Terms. You shall not: (1) except as permitted by applicable law, decompile, reverse engineer, disassemble, attempt to derive the source code of, or decrypt the App; (2) make any modification, adaptation, improvement, enhancement, translation, or derivative work from the App; (3) violate any applicable laws, rules, or regulations in connection with your access or use of the App; (4) remove, alter, or obscure any proprietary notice (including any notice of copyright or trademark) posted by us or the licensors of the App; (5) use the App for any revenue-generating endeavor, commercial enterprise, or other purpose for which it is not designed or intended; (6) make the App available over a network or other environment permitting access or use by multiple devices or users at the same time; (7) use the App for creating a product, service, or software that is, directly or indirectly, competitive with or in any way a substitute for the App; (8) use the App to send automated queries to any website or to send any unsolicited commercial email; or (9) use any proprietary information or any of our interfaces or our other intellectual property in the design, development, manufacture, licensing, or distribution of any applications, accessories, or devices for use with the App.`,
    },
    { type: 'h3', text: `Apple and Android Devices` },
    {
      type: 'p',
      text: `The following terms apply when you use the App obtained from either the Apple Store or Google Play (each an "App Distributor") to access the Services: (1) the license granted to you for our App is limited to a non-transferable license to use the application on a device that utilizes the Apple iOS or Android operating systems, as applicable, and in accordance with the usage rules set forth in the applicable App Distributor’s terms of service; (2) we are responsible for providing any maintenance and support services with respect to the App as specified in the terms and conditions of this mobile application license contained in these Legal Terms or as otherwise required under applicable law, and you acknowledge that each App Distributor has no obligation whatsoever to furnish any maintenance and support services with respect to the App; (3) in the event of any failure of the App to conform to any applicable warranty, you may notify the applicable App Distributor, and the App Distributor, in accordance with its terms and policies, may refund the purchase price, if any, paid for the App, and to the maximum extent permitted by applicable law, the App Distributor will have no other warranty obligation whatsoever with respect to the App; (4) you represent and warrant that (i) you are not located in a country that is subject to a US government embargo, or that has been designated by the US government as a "terrorist supporting" country and (ii) you are not listed on any US government list of prohibited or restricted parties; (5) you must comply with applicable third-party terms of agreement when using the App, e.g., if you have a VoIP application, then you must not be in violation of their wireless data service agreement when using the App; and (6) you acknowledge and agree that the App Distributors are third-party beneficiaries of the terms and conditions in this mobile application license contained in these Legal Terms, and that each App Distributor will have the right (and will be deemed to have accepted the right) to enforce the terms and conditions in this mobile application license contained in these Legal Terms against you as a third-party beneficiary thereof.`,
    },

    { type: 'h2', text: `10. SERVICES MANAGEMENT` },
    {
      type: 'p',
      text: `We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.`,
    },

    { type: 'h2', text: `11. TERM AND TERMINATION` },
    {
      type: 'p',
      text: `These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.`,
    },
    {
      type: 'p',
      text: `If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.`,
    },

    { type: 'h2', text: `12. MODIFICATIONS AND INTERRUPTIONS` },
    {
      type: 'p',
      text: `We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We also reserve the right to modify or discontinue all or part of the Services without notice at any time. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.`,
    },
    {
      type: 'p',
      text: `We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith.`,
    },

    { type: 'h2', text: `13. GOVERNING LAW` },
    {
      type: 'p',
      text: `These Legal Terms and your use of the Services are governed by and construed in accordance with the laws of the Commonwealth of Pennsylvania applicable to agreements made and to be entirely performed within the Commonwealth of Pennsylvania, without regard to its conflict of law principles.`,
    },

    { type: 'h2', text: `14. DISPUTE RESOLUTION` },
    { type: 'h3', text: `Informal Negotiations` },
    {
      type: 'p',
      text: `To expedite resolution and control the cost of any dispute, controversy, or claim related to these Legal Terms (each a "Dispute" and collectively, the "Disputes") brought by either you or us (individually, a "Party" and collectively, the "Parties"), the Parties agree to first attempt to negotiate any Dispute (except those Disputes expressly provided below) informally for at least thirty (30) days before initiating arbitration. Such informal negotiations commence upon written notice from one Party to the other Party.`,
    },
    { type: 'h3', text: `Binding Arbitration` },
    {
      type: 'p',
      text: `If the Parties are unable to resolve a Dispute through informal negotiations, the Dispute (except those Disputes expressly excluded below) will be finally and exclusively resolved by binding arbitration. YOU UNDERSTAND THAT WITHOUT THIS PROVISION, YOU WOULD HAVE THE RIGHT TO SUE IN COURT AND HAVE A JURY TRIAL. The arbitration shall be commenced and conducted under the Commercial Arbitration Rules of the American Arbitration Association ("AAA") and, where appropriate, the AAA’s Supplementary Procedures for Consumer Related Disputes ("AAA Consumer Rules"), both of which are available at the American Arbitration Association (AAA) website. Your arbitration fees and your share of arbitrator compensation shall be governed by the AAA Consumer Rules and, where appropriate, limited by the AAA Consumer Rules. If such costs are determined by the arbitrator to be excessive, we will pay all arbitration fees and expenses. The arbitration may be conducted in person, through the submission of documents, by phone, or online. The arbitrator will make a decision in writing, but need not provide a statement of reasons unless requested by either Party. The arbitrator must follow applicable law, and any award may be challenged if the arbitrator fails to do so. Except where otherwise required by the applicable AAA rules or applicable law, the arbitration will take place in Philadelphia, Pennsylvania, United States. Except as otherwise provided herein, the Parties may litigate in court to compel arbitration, stay proceedings pending arbitration, or to confirm, modify, vacate, or enter judgment on the award entered by the arbitrator.`,
    },
    {
      type: 'p',
      text: `If for any reason, a Dispute proceeds in court rather than arbitration, the Dispute shall be commenced or prosecuted in the state and federal courts located in Philadelphia, Pennsylvania, United States, and the Parties hereby consent to, and waive all defenses of lack of personal jurisdiction, and forum non conveniens with respect to venue and jurisdiction in such state and federal courts. Application of the United Nations Convention on Contracts for the International Sale of Goods and the Uniform Computer Information Transaction Act (UCITA) are excluded from these Legal Terms.`,
    },
    {
      type: 'p',
      text: `If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.`,
    },
    { type: 'h3', text: `Restrictions` },
    {
      type: 'p',
      text: `The Parties agree that any arbitration shall be limited to the Dispute between the Parties individually. To the full extent permitted by law, (a) no arbitration shall be joined with any other proceeding; (b) there is no right or authority for any Dispute to be arbitrated on a class-action basis or to utilize class action procedures; and (c) there is no right or authority for any Dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.`,
    },
    { type: 'h3', text: `Exceptions to Informal Negotiations and Arbitration` },
    {
      type: 'p',
      text: `The Parties agree that the following Disputes are not subject to the above provisions concerning informal negotiations binding arbitration: (a) any Disputes seeking to enforce or protect, or concerning the validity of, any of the intellectual property rights of a Party; (b) any Dispute related to, or arising from, allegations of theft, piracy, invasion of privacy, or unauthorized use; and (c) any claim for injunctive relief. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.`,
    },

    { type: 'h2', text: `15. CORRECTIONS` },
    {
      type: 'p',
      text: `There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.`,
    },

    { type: 'h2', text: `16. DISCLAIMER` },
    {
      type: 'p',
      text: `THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE CAUTION WHERE APPROPRIATE.`,
    },

    { type: 'h2', text: `17. LIMITATIONS OF LIABILITY` },
    {
      type: 'p',
      text: `IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO $100.00 USD.`,
    },
    {
      type: 'p',
      text: `CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS.`,
    },

    { type: 'h2', text: `18. INDEMNIFICATION` },
    {
      type: 'p',
      text: `You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys’ fees and expenses, made by any third party due to or arising out of: (1) use of the Services; (2) breach of these Legal Terms; (3) any breach of your representations and warranties set forth in these Legal Terms; (4) your violation of the rights of a third party, including but not limited to intellectual property rights; or (5) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it.`,
    },

    { type: 'h2', text: `19. USER DATA` },
    {
      type: 'p',
      text: `We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.`,
    },

    { type: 'h2', text: `20. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES` },
    {
      type: 'p',
      text: `Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing. YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction which require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means.`,
    },

    { type: 'h2', text: `21. CALIFORNIA USERS AND RESIDENTS` },
    {
      type: 'p',
      text: `If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834 or by telephone at (800) 952-5210 or (916) 445-1254.`,
    },

    { type: 'h2', text: `22. MISCELLANEOUS` },
    {
      type: 'p',
      text: `These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.`,
    },

    { type: 'h2', text: `23. CONTACT US` },
    {
      type: 'p',
      text: `In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:`,
    },
    { type: 'p', text: `Comly` },
    { type: 'p', text: `Email: raphaelmuthu21@gmail.com or marceldonk777@gmail.com` },
    {
      type: 'p',
      text: `Mail: [MAILING ADDRESS TO BE PROVIDED], Philadelphia, Pennsylvania [ZIP CODE], United States`,
    },
  ],
};

/**
 * Real Privacy Policy, matched against what the app actually does as of
 * PRIVACY_VERSION below — not a generic template. Sections describing specific
 * data (the `profiles_private` fields, the AI/Resend/Supabase sub-processors,
 * the guardian-consent mechanism) were written by reading the schema and
 * service code, not assumed. The [MAILING ADDRESS TO BE PROVIDED] / [ZIP CODE]
 * placeholders match the ones in TERMS_OF_SERVICE and should be filled with the
 * same values at the same time.
 *
 * Two things this document is honest about because the app currently is:
 *   - Account deletion is support-request-only; there is no self-service
 *     delete button yet. (Apple requires one for apps that support account
 *     creation — this is worth building before submission, not just
 *     disclosing around.)
 *   - Push notification permission code exists but no device token is
 *     currently stored anywhere, so that paragraph is phrased conditionally
 *     rather than as a present-tense claim.
 */
export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: 'September 06, 2026',
  version: PRIVACY_VERSION,
  blocks: [
    { type: 'h2', text: `AGREEMENT TO THIS PRIVACY POLICY` },
    {
      type: 'p',
      text: `This Privacy Policy for Comly ("Company," "we," "us," or "our") describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you download and use our mobile application (Comly), or engage with us in any other related way, including any sales, marketing, or events.`,
    },
    {
      type: 'p',
      text: `We are Comly ("Company," "we," "us," or "our"), operated by co-founders Raphael Muthu and Marcel Afsar, and based in Philadelphia, Pennsylvania, United States. You can contact us by email at raphaelmuthu21@gmail.com or marceldonk777@gmail.com, or by mail at [MAILING ADDRESS TO BE PROVIDED], Philadelphia, Pennsylvania [ZIP CODE], United States.`,
    },
    {
      type: 'p',
      text: `Reading this Privacy Policy will help you understand your privacy rights and choices. If you do not agree with our policies and practices, please do not use our Services. If you still have questions or concerns, please contact us using the details at the end of this document.`,
    },

    { type: 'h2', text: `1. WHAT INFORMATION DO WE COLLECT?` },
    { type: 'h3', text: `Personal information you disclose to us` },
    {
      type: 'p',
      text: `We collect personal information that you voluntarily provide when you register on the Services, express an interest in obtaining information about us or our Services, or otherwise contact us.`,
    },
    {
      type: 'p',
      text: `The personal information we collect depends on the context of your interactions with us and the Services, but may include the following:`,
    },
    { type: 'li', text: `Name and email address` },
    {
      type: 'li',
      text: `Date of birth — required at sign-up to determine which safety tier of jobs you may see or post, and cannot be edited by you after your account is created`,
    },
    { type: 'li', text: `Neighborhood (a general area, not your exact address)` },
    { type: 'li', text: `Profile photo, if you choose to add one` },
    {
      type: 'li',
      text: `A short bio, skills, and preferred job categories, if you choose to add them`,
    },
    {
      type: 'li',
      text: `Phone number and preferred contact method, if you choose to add them — kept in a separate, more restricted part of our database and never shown to another user until a job application between you has been accepted by both sides`,
    },
    {
      type: 'li',
      text: `If you are a minor and your account requires guardian approval: your parent or guardian's name and email address, and a school email address if you choose to provide one`,
    },
    {
      type: 'li',
      text: `Job listings you post, applications you submit, messages sent through the application flow, reviews you write or receive, and reports you or others file about a job`,
    },
    {
      type: 'li',
      text: `Records of which version of this Privacy Policy and our Terms of Service you accepted, and when`,
    },
    {
      type: 'p',
      text: `If you sign in using Google or Apple, we receive your name and email address from that provider so we can create and secure your account. We do not receive your password for those accounts.`,
    },
    {
      type: 'p',
      text: `All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.`,
    },
    { type: 'h3', text: `Information collected automatically` },
    {
      type: 'p',
      text: `We do not currently use any third-party analytics, advertising, or crash-reporting service in the Services. Our infrastructure providers, described below, automatically log standard technical information needed to operate the Services (such as request timestamps and error logs), the way any server does.`,
    },

    { type: 'h2', text: `2. HOW DO WE PROCESS YOUR INFORMATION?` },
    { type: 'p', text: `We process your personal information for a variety of reasons, including:` },
    {
      type: 'li',
      text: `To create and manage your account, verify your age, and determine which jobs are safe and legal for you to see, post, or apply to.`,
    },
    {
      type: 'li',
      text: `To operate the guardian-approval process for helpers under 18, where a request is required, including sending the approval email and recording the outcome.`,
    },
    {
      type: 'li',
      text: `To connect residents and helpers: showing your listing or profile to other users, matching job posts with helpers, and unlocking contact details only after both sides accept a specific job.`,
    },
    {
      type: 'li',
      text: `To automatically screen job listings and application messages for safety and to suggest a fair pay range and realistic duration, using the AI processing described in Section 4.`,
    },
    {
      type: 'li',
      text: `To operate reviews, ratings, and the no-show reporting system, and to act on confirmed reports (including applying or reversing a strike on an account).`,
    },
    {
      type: 'li',
      text: `To respond to support requests you send us and to enforce our Terms of Service.`,
    },
    {
      type: 'li',
      text: `To keep the Services secure, including preventing a user from editing their own age, verification status, strikes, or account standing.`,
    },
    { type: 'p', text: `We do not use your personal information for advertising, and we do not sell it.` },

    { type: 'h2', text: `3. WHAT LEGAL BASES DO WE RELY ON?` },
    {
      type: 'p',
      text: `We only process your personal information when we believe it is necessary and we have a valid legal reason to do so, such as with your consent, to comply with the law, to provide you services in order to enter into or fulfill our contractual obligations, to protect your rights, or to fulfill our legitimate business interests.`,
    },

    { type: 'h2', text: `4. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?` },
    {
      type: 'p',
      text: `We may need to share your personal information in the following situations:`,
    },
    {
      type: 'li',
      text: `With other users of the Services. Your name, profile photo, neighborhood, bio, rating, and reviews are visible to other users as part of how the marketplace works. Your exact address and contact details are never shown to another user until a specific job application between you has been accepted by both sides.`,
    },
    {
      type: 'li',
      text: `With Supabase, our database, authentication, and file storage provider, which stores and processes the personal information described in this policy on our behalf.`,
    },
    {
      type: 'li',
      text: `With Google, whose Gemini AI model we use, through our own server, to help classify a job's safety tier and suggest fair pay — the job or application text you submit is sent for this processing. If you sign in with a Google or Apple account, those providers also process the account information needed to authenticate you.`,
    },
    {
      type: 'li',
      text: `With Resend, our email delivery provider, solely to send a one-time guardian-approval email — only the parent or guardian's email address and the helper's name are shared with them for this purpose.`,
    },
    {
      type: 'li',
      text: `With law enforcement, government authorities, or other third parties, if required by law, to enforce our Terms of Service, or to protect the rights, property, or safety of Comly, our users, or others — for example, in response to a confirmed report involving a minor's safety.`,
    },
    {
      type: 'li',
      text: `In connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business by another company.`,
    },

    { type: 'h2', text: `5. HOW DO WE HANDLE YOUR SOCIAL LOGINS?` },
    {
      type: 'p',
      text: `Our Services offer you the ability to register and log in using your Google or Apple account. Where you choose to do this, we receive certain profile information about you from that provider, such as your name and email address. We will use the information we receive only for the purposes described in this Privacy Policy. We do not have access to, and do not store, your password for those accounts.`,
    },

    { type: 'h2', text: `6. DO WE OFFER PUSH NOTIFICATIONS?` },
    {
      type: 'p',
      text: `If you grant permission, the Services can send you push notifications about activity on your account, such as a new application or a message. If push notifications are active on your device, we may store a device token, which we use only to deliver these notifications and never to identify you across other apps or services. You can withdraw this permission at any time in your device settings.`,
    },

    { type: 'h2', text: `7. HOW LONG DO WE KEEP YOUR INFORMATION?` },
    {
      type: 'p',
      text: `We keep your personal information for as long as necessary to provide the Services and fulfill the purposes described in this Privacy Policy, unless a longer retention period is required or permitted by law. Job, review, and no-show records tied to another user's account may be retained after your own account is closed, to the extent needed to keep those other records accurate.`,
    },
    {
      type: 'p',
      text: `When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize it, or, if this is not possible, securely store it and isolate it from further processing until deletion is possible.`,
    },

    { type: 'h2', text: `8. HOW DO WE KEEP YOUR INFORMATION SAFE?` },
    {
      type: 'p',
      text: `We use role- and row-level access controls in our database so that a user's more sensitive information — such as a phone number or a guardian's contact details — cannot be read by other users directly, and so that safety-relevant fields, such as your age, strikes, or verification status, cannot be edited by anyone but our own server-side systems, not even by you. Information is transmitted to and from our servers over encrypted connections.`,
    },
    {
      type: 'p',
      text: `Although we take reasonable technical and organizational measures, no electronic transmission or storage system is completely secure, and we cannot guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security. You should only access the Services within a secure environment.`,
    },

    { type: 'h2', text: `9. DO WE COLLECT INFORMATION FROM MINORS?` },
    {
      type: 'p',
      text: `The Services are intended for users who are at least 13 years of age. We do not knowingly collect, solicit data from, or market to children under 13 years of age. By using the Services, you represent that you are at least 13.`,
    },
    {
      type: 'p',
      text: `If you are between 13 and 17, some jobs will be unavailable to you outright based on your age, and some jobs require your parent or guardian to approve your account first. That approval works without your guardian ever creating a Comly account: we email them a one-time link, which they can use once to record their approval. We store only the fact and time of that approval and the guardian's name and email — not a password or any other account for them.`,
    },
    {
      type: 'p',
      text: `If we learn that we have collected personal information from a user under 13 without the verifiable consent required by law, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under 13, please contact us using the details below.`,
    },

    { type: 'h2', text: `10. WHAT ARE YOUR PRIVACY RIGHTS?` },
    {
      type: 'p',
      text: `You can review, change, or update most of your account information at any time by editing your profile in the app. Your date of birth, age classification, verification status, and account standing cannot be self-edited, for the safety reasons described above — contact us if any of that information is inaccurate.`,
    },
    {
      type: 'p',
      text: `To request that we delete your account and associated personal information, contact us through Help & Support in the app or using the details below. We will confirm and act on deletion requests within a reasonable time, subject to the retention needs described in Section 7 — for example, keeping a record of a confirmed no-show strike that is also tied to another user's account.`,
    },
    {
      type: 'p',
      text: `Withdrawing consent: If we are relying on your consent to process your personal information, you have the right to withdraw your consent at any time. Withdrawing consent will not affect the lawfulness of any processing conducted before you withdraw it.`,
    },

    { type: 'h2', text: `11. CONTROLS FOR DO-NOT-TRACK FEATURES` },
    {
      type: 'p',
      text: `Most web browsers and some mobile operating systems include a Do-Not-Track ("DNT") feature. We do not currently use tracking technology that responds to DNT signals, so no additional action is taken in response to them. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Policy.`,
    },

    { type: 'h2', text: `12. DO CALIFORNIA RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?` },
    {
      type: 'p',
      text: `California Civil Code Section 1798.83 permits California residents to request certain information regarding our disclosure of personal information to third parties for their direct marketing purposes. We do not disclose personal information to third parties for their own direct marketing purposes. If you have questions about this section, you may contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834, or by telephone at (800) 952-5210 or (916) 445-1254.`,
    },

    { type: 'h2', text: `13. DO WE MAKE UPDATES TO THIS POLICY?` },
    {
      type: 'p',
      text: `We may update this Privacy Policy from time to time. When we do, the version and date at the top of this document will change, and the new version will be recorded against your account the next time you accept it. Material changes may require you to re-accept this policy before continuing to use certain features.`,
    },

    { type: 'h2', text: `14. HOW CAN YOU CONTACT US ABOUT THIS POLICY?` },
    {
      type: 'p',
      text: `If you have questions or comments about this notice, you may contact us by email at raphaelmuthu21@gmail.com or marceldonk777@gmail.com, or by mail at Comly, [MAILING ADDRESS TO BE PROVIDED], Philadelphia, Pennsylvania [ZIP CODE], United States.`,
    },
  ],
};
