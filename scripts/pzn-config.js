/*
 * Conductrics wiring, shared by the edge worker and the client-side fallback so the two can never
 * disagree. `agents` is keyed by Conductrics "lob", not by segment: Traits.pm maps a trait segment
 * to a prospect_* lob, while the rules engine returns the lob directly.
 *
 * Which segments a page personalizes, and what each shows, is authored on the page as
 * `personalization` section metadata. Only the Conductrics ids live here.
 */

const DEV_AGENTS = {
  prospect_senior: 'a-eb50k6rzFw',
  prospect_student: 'a-4qNAyncPhUEk',
  prospect_newcomer: 'a-DTABfypuDzoM',
  prospect_mass: 'a-cXyggLfoADf7',
  prospect: 'a-NYwMhjQZiMIL',
  senior: 'a-FWzL0uqSJt',
  student: 'a-eaXPPuXFck',
  newcomer: 'a-0WwBgO4WRY',
  mass: 'a-x82f0ZIyOl',
};

const PROD_AGENTS = {
  prospect_senior: 'a-bsccpF73lk',
  prospect_student: 'a-xM5n9lnvsv',
  prospect_newcomer: 'a-AKUewC1bLn',
  prospect_mass: 'a-O7H5nNJsGu',
  prospect: 'a-kWJUYdN5Vq3O',
  senior: 'a-M4mBcKdtHq',
  student: 'a-NSheHciQxj',
  newcomer: 'a-HhfSTaRyI5',
  mass: 'a-aEmoT4lKSl',
};

const DECISION_LOGIC = 'AGrQuIjdEunH|pIXOKGSsEcqf';
const SAVINGS_AGENT = { dev: 'a-EZTf1uvKTY', prod: 'a-k3uKXzolge' };

export const TRAIT_LOBS = {
  'international-student': 'prospect_student',
  student: 'prospect_student',
  newcomer: 'prospect_newcomer',
  senior: 'prospect_senior',
};

export const TRAIT_SEGMENTS = Object.keys(TRAIT_LOBS);

export const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];

export default function pages(prod = false) {
  const agents = prod ? PROD_AGENTS : DEV_AGENTS;
  return {
    '/bank-accounts': { decisionLogic: DECISION_LOGIC, agents },
    '/bank-accounts/chequing-accounts': { decisionLogic: DECISION_LOGIC, agents },
    '/bank-accounts/savings-accounts': {
      agent: prod ? SAVINGS_AGENT.prod : SAVINGS_AGENT.dev,
      arms: { B: 'hisa', D: 'd2d', F: 'us-hisa' },
    },
  };
}
