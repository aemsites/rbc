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

/*
 * Conductrics resolves an agent only when the request's location is in that agent's own URL list,
 * and RBC maintains one agent set per front end. Measured against the live account: the PROD
 * segment agents cover www and the EDS preview, while a-k3uKXzolge covers www alone and
 * a-EZTf1uvKTY covers STE and the EDS preview. So an EDS deployment mixes the two sets, which is
 * why this is named per deployment rather than inferred from the origin.
 */
const AGENT_SETS = {
  eds: { agents: PROD_AGENTS, savings: 'a-EZTf1uvKTY' },
  prod: { agents: PROD_AGENTS, savings: 'a-k3uKXzolge' },
  dev: { agents: DEV_AGENTS, savings: 'a-EZTf1uvKTY' },
};

export const TRAIT_LOBS = {
  'international-student': 'prospect_student',
  student: 'prospect_student',
  newcomer: 'prospect_newcomer',
  senior: 'prospect_senior',
  mass: 'prospect_mass',
};

export const TRAIT_SEGMENTS = Object.keys(TRAIT_LOBS);

export const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];

export default function pages(set = 'eds') {
  const { agents, savings } = AGENT_SETS[set] || AGENT_SETS.eds;
  return {
    '/bank-accounts': { decisionLogic: DECISION_LOGIC, agents },
    '/bank-accounts/chequing-accounts': { decisionLogic: DECISION_LOGIC, agents },
    '/bank-accounts/savings-accounts': {
      agent: savings,
      arms: { B: 'hisa', D: 'd2d', F: 'us-hisa' },
    },
  };
}
