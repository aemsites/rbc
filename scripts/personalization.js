/*
 * Client-side half of server-side personalization.
 *
 * The edge worker resolves the decision and publishes it as serverSideRulesEngineResponse,
 * mirroring Utils::script_variable. Two things still have to happen in the browser:
 *
 * 1. Analytics. Conductrics Express and the client JS API emit experience_impression
 *    automatically via the deploy target; the server-side REST API does not, so we emit it here.
 * 2. Tab pre-selection, the one post-render treatment on the PBA homepage.
 *
 * Everything else RBC personalizes is configured by Digital Marketing in Conductrics Express
 * and targets CSS selectors from their admin portal, so it needs no code here.
 */

function dataLayer() {
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

// PERL logs both responses so client JS can push model_result: which decision logic was
// requested, what the model returned, and whether the visitor was served control or treatment.
function pushModelResult(ssr) {
  const rules = ssr.rules?.result_content || {};
  const sels = ssr.conductrics?.result_content?.sels || {};
  const [arm] = Object.values(sels);
  dataLayer().push({
    event: 'model_result',
    details: '',
    model_result: {
      decision_logic: rules.source || null,
      model_response: rules.lob || null,
      conductrics_selection: arm || 'A',
      variant: ssr.variant || 'default',
    },
  });
}

function pushExperienceImpressions(ssr) {
  const sels = ssr.conductrics?.result_content?.sels || {};
  Object.entries(sels).forEach(([agent, arm]) => {
    dataLayer().push({
      event: 'experience_impression',
      details: '',
      experience: {
        conductrics_agent_id: agent,
        conductrics_variant: arm,
        variant: ssr.variant || 'default',
      },
    });
  });
}

/*
 * Post-render treatment: open the tab matching the visitor's segment instead of the first one.
 * Tabs opt in by being named after a segment, so no segment-to-tab table lives in code.
 */
function preselectTab(segment) {
  if (!segment || segment === 'default') return;
  const tab = document.querySelector(`.tabs .tabs-tab#tab-${CSS.escape(segment)}`);
  if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
}

export default function personalize() {
  const ssr = window.serverSideRulesEngineResponse;
  if (!ssr) return;

  pushModelResult(ssr);
  pushExperienceImpressions(ssr);
  preselectTab(ssr.rules?.result_content?.lob);
}
