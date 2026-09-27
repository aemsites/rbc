import applyConfig from '../../scripts/config.js';

const TEMPLATE = `
<form class="account-selector-form">
  <div class="account-selector-progress" aria-hidden="true"></div>
  <p class="account-selector-step" data-of="of"></p>
  <fieldset>
    <legend>
      <p data-key="q1">How many purchases, withdrawals and bill payments do you make on average each month?</p>
      <p data-key="q1-tip"><strong>Tip:</strong> Exclude <em>Interac</em> e-Transfers, public transit transactions and transfers between RBC accounts — they're free</p>
    </legend>
    <div data-full class="account-selector-slider">
      <input type="range" min="0" max="25" value="0" aria-label="Transactions per month, 0 to 25 or more">
      <span>0</span><span>25+</span>
      <input type="number" name="transactions" min="0" max="99" value="0" aria-label="Transactions per month">
    </div>
    <details data-full class="account-selector-help">
      <summary data-key="q1-help">Help Me Estimate This</summary>
      <p data-key="q1-help-intro">Each month, how often do you:</p>
      <label><span data-key="q1-help-debit">Use your debit card</span> <input type="number" min="0" max="99" value="0" data-sum></label>
      <label><span data-key="q1-help-atm">Use an ATM</span> <input type="number" min="0" max="99" value="0" data-sum></label>
      <label><span data-key="q1-help-bills">Pay bills from your account</span> <input type="number" min="0" max="99" value="0" data-sum></label>
    </details>
    <div data-short class="account-selector-options">
      <label><input type="radio" name="transactions" value="6" required> <span data-key="q1-less">Less Than 12</span></label>
      <label><input type="radio" name="transactions" value="12" required> <span data-key="q1-more">12 or More</span></label>
    </div>
  </fieldset>
  <fieldset>
    <legend><p data-key="q2">How often would you use non-RBC ATMs in Canada each month?</p></legend>
    <input type="number" name="atms" min="0" max="99" value="0" aria-label="Non-RBC ATM uses per month">
  </fieldset>
  <fieldset data-full>
    <legend><p data-key="q3">Do you need any of these other products or features?</p></legend>
    <div class="account-selector-options">
      <label><input type="checkbox" name="additional-accounts" value="Yes"> <span data-key="q3-accounts">Additional Chequing Account(s)</span></label>
      <label><input type="checkbox" name="safe-deposit" value="Yes"> <span data-key="q3-safe">Safe Deposit Box</span></label>
      <label><input type="checkbox" name="overdraft" value="Yes"> <span data-key="q3-overdraft">Overdraft Protection*</span></label>
      <label><input type="checkbox" name="credit-card" value="Yes"> <span data-key="q3-credit">Credit Card*</span></label>
    </div>
    <p class="account-selector-note" data-key="q3-note">*Note: You would need to apply and be approved for each of these separately.</p>
  </fieldset>
  <fieldset data-full>
    <legend>
      <p data-key="q4">Did you know that you can unlock Avion points and potential savings by enrolling your RBC bank account in the Value Program?</p>
      <p data-key="q4-tip">Find out how much you could earn and save by selecting products you're interested in or already have:</p>
    </legend>
    <div class="account-selector-options">
      <label><input type="checkbox" name="investments" value="Yes"> <span data-key="q4-investments">Personal Investment</span></label>
      <label><input type="checkbox" name="mortgage" value="Yes"> <span data-key="q4-mortgage">Residential Mortgage</span></label>
      <label><input type="checkbox" name="business" value="Yes"> <span data-key="q4-business">Small Business Account</span></label>
    </div>
    <p class="account-selector-note" data-key="q4-note">Note: We only ask this question to show your potential rewards and savings. You would need to enrol your bank account and apply and be approved for these products separately if you don't already have them.</p>
  </fieldset>
  <fieldset data-full>
    <legend><p data-key="q5">Does one of the following apply to you? (If yes, you could save on monthly fees.)</p></legend>
    <div class="account-selector-options">
      <label><input type="radio" name="status" value="student"> <span data-key="q5-student">Full-time student or anyone 24 and younger</span></label>
      <label><input type="radio" name="status" value="senior"> <span data-key="q5-senior">Senior (age 65+)</span></label>
      <label><input type="radio" name="status" value="indigenous"> <span data-key="q5-indigenous">Indigenous peoples</span></label>
      <label><input type="radio" name="status" value="newcomer"> <span data-key="q5-newcomer">Newcomer to Canada</span></label>
      <label><input type="radio" name="status" value="rdsp"> <span data-key="q5-rdsp">RDSP holder</span></label>
      <label><input type="radio" name="status" value="none" checked> <span data-key="q5-none">None of these</span></label>
    </div>
  </fieldset>
  <div class="account-selector-nav">
    <button type="button" class="account-selector-back" data-key="back">Back</button>
    <button type="submit" class="button accent"></button>
    <span hidden data-key="continue">Continue</span>
    <span hidden data-key="finish">Show Me My Account</span>
    <span hidden data-key="finish-short">Continue at Account Selector Tool</span>
    <span hidden data-key="minus">Minus one</span>
    <span hidden data-key="plus">Plus one</span>
  </div>
</form>
<div class="account-selector-results" hidden>
  <h2><span data-key="result">Based on your selections, we recommend</span> <span></span></h2>
  <ul class="account-selector-cards">
    <li data-name="RBC Day to Day Banking">
      <p class="account-selector-badge" data-key="badge">Recommended</p>
      <div class="account-selector-head"><h3>RBC Day to Day Banking</h3><p>The Essentials</p></div>
      <div class="account-selector-body">
        <p>$4/mo</p>
        <ul>
          <li>12 debits of any kind, plus unlimited e-Transfers, self-serve transfers, Public Transit, and Virtual Visa Debit transactions</li>
          <li>$0 monthly fee after Seniors Rebate</li>
        </ul>
        <p class="button-wrapper"><a class="button primary" href="https://public.rbcroyalbank.com/sgw1/cb/public-account-open?lang=en-CA&amp;pid1=022">Open This Account</a></p>
        <p><a href="/bank-accounts/chequing-accounts/day-to-day-banking">View Account Details</a></p>
      </div>
    </li>
    <li data-name="RBC Advantage Banking">
      <p class="account-selector-badge" data-key="badge">Recommended</p>
      <div class="account-selector-head"><h3>RBC Advantage Banking</h3><p>Unlimited Debits &amp; More</p></div>
      <div class="account-selector-body">
        <p>$12.95/mo</p>
        <ul>
          <li>Unlimited debit transactions in Canada</li>
          <li>No RBC fee to use another bank's ATM in Canada</li>
          <li>No monthly fee for students and newcomers</li>
        </ul>
        <p class="button-wrapper"><a class="button primary" href="https://public.rbcroyalbank.com/sgw1/cb/public-account-open?lang=en-CA&amp;pid1=099">Open This Account</a></p>
        <p><a href="/bank-accounts/chequing-accounts/advantage-banking">View Account Details</a></p>
      </div>
    </li>
    <li data-name="RBC Signature No Limit Banking">
      <p class="account-selector-badge" data-key="badge">Recommended</p>
      <div class="account-selector-head"><h3>RBC Signature No Limit Banking</h3><p>Unlimited Debits &amp; Even More</p></div>
      <div class="account-selector-body">
        <p>$16.95/mo</p>
        <ul>
          <li>Unlimited debit transactions in Canada</li>
          <li>Up to $48 credit card annual fee rebate</li>
          <li>Free overdraft protection</li>
        </ul>
        <p class="button-wrapper"><a class="button primary" href="https://public.rbcroyalbank.com/sgw1/cb/public-account-open?lang=en-CA&amp;pid1=004">Open This Account</a></p>
        <p><a href="/bank-accounts/chequing-accounts/signature-no-limit-banking">View Account Details</a></p>
      </div>
    </li>
    <li data-name="RBC VIP Banking">
      <p class="account-selector-badge" data-key="badge">Recommended</p>
      <div class="account-selector-head"><h3>RBC VIP Banking</h3><p>All-Inclusive Banking</p></div>
      <div class="account-selector-body">
        <p>$30/mo</p>
        <ul>
          <li>Unlimited debit transactions worldwide</li>
          <li>Up to $120 credit card annual fee rebate</li>
          <li>Up to 2 additional Canadian dollar accounts plus 1 U.S. dollar account</li>
        </ul>
        <p class="button-wrapper"><a class="button primary" href="https://public.rbcroyalbank.com/sgw1/cb/public-account-open?lang=en-CA&amp;pid1=020">Open This Account</a></p>
        <p><a href="/bank-accounts/chequing-accounts/vip-banking">View Account Details</a></p>
      </div>
    </li>
  </ul>
  <button type="button" class="button secondary" data-key="edit">Edit Details</button>
</div>
`;

const PROXY = '/cgi-bin/bank-accounts/chequing-accounts/proxy.cgi';
const FIELDS = {
  'credit-card': 'creditCardFee',
  'safe-deposit': 'safeDepositBox',
  'additional-accounts': 'additionalAccounts',
  overdraft: 'overdraftProtection',
  investments: 'investments',
  mortgage: 'mortgages',
  business: 'smallBusiness',
  student: 'isStudent',
  senior: 'isSenior',
  indigenous: 'isIndigenous',
  newcomer: 'isNewcomer',
  rdsp: 'isRDSP',
};

function answers(form) {
  const data = Object.fromEntries(Object.values(FIELDS).map((f) => [f, 'No']));
  data.numDebits = Number(form.elements.transactions.value || 0);
  data.numInterac = Number(form.elements.atms.value || 0);
  form.querySelectorAll('input:checked').forEach((input) => {
    const field = FIELDS[input.type === 'radio' ? input.value : input.name];
    if (field) data[field] = 'Yes';
  });
  return data;
}

// ponytail: rule of thumb when the CGI is unreachable (previews); production uses the proxy
function guess(a) {
  if (a.additionalAccounts === 'Yes') return 'RBC VIP Banking';
  if (a.creditCardFee === 'Yes' || a.safeDepositBox === 'Yes') return 'RBC Signature No Limit Banking';
  if (a.numDebits <= 12 && a.isStudent !== 'Yes' && a.isNewcomer !== 'Yes') return 'RBC Day to Day Banking';
  return 'RBC Advantage Banking';
}

async function recommend(a) {
  try {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(a),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    const name = json.result_code === 0 && json.result_content?.recommended;
    if (name) return name.trim();
  } catch (e) { /* fall through */ }
  return guess(a);
}

// `short`: two questions that hand off to the page in the `handoff` row
export default function decorate(block) {
  const config = applyConfig(block, TEMPLATE);
  const short = block.classList.contains('short');
  block.querySelectorAll(short ? '[data-full]' : '[data-short]').forEach((el) => el.remove());
  const form = block.querySelector('form');
  const steps = [...form.querySelectorAll('fieldset')];
  const progress = form.querySelector('.account-selector-progress');
  progress.append(...steps.map(() => document.createElement('i')));
  const stepLabel = form.querySelector('.account-selector-step');
  const back = form.querySelector('.account-selector-back');
  const next = form.querySelector('[type=submit]');
  const label = (key) => form.querySelector(`[data-key="${key}"]`).textContent;
  const results = block.querySelector('.account-selector-results');
  const cards = results.querySelector('.account-selector-cards');
  const heading = results.querySelector('h2');
  const edit = results.querySelector('.account-selector-results > button');

  const prefill = new URLSearchParams(window.location.search);
  form.querySelectorAll('input[type=number]').forEach((input) => {
    if (prefill.has(input.name)) input.value = prefill.get(input.name);
    const stepper = document.createElement('div');
    stepper.className = 'account-selector-stepper';
    input.replaceWith(stepper);
    [-1, 1].forEach((step) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = step < 0 ? 'account-selector-minus' : 'account-selector-plus';
      button.setAttribute('aria-label', step < 0 ? label('minus') : label('plus'));
      button.addEventListener('click', () => {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || Infinity;
        input.value = Math.min(Math.max(Number(input.value || 0) + step, min), max);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      stepper.append(button);
    });
    stepper.insertBefore(input, stepper.lastElementChild);
  });
  const range = form.querySelector('input[type=range]');
  const { transactions } = form.elements;
  if (range) {
    range.value = transactions.value;
    range.addEventListener('input', () => { transactions.value = range.value; });
    transactions.addEventListener('input', () => { range.value = Math.min(transactions.value, 25); });
    form.querySelectorAll('[data-sum]').forEach((input) => input.addEventListener('input', () => {
      transactions.value = [...form.querySelectorAll('[data-sum]')].reduce((sum, i) => sum + Number(i.value || 0), 0);
      range.value = Math.min(transactions.value, 25);
    }));
  }

  let current = 0;
  const show = (i) => {
    current = i;
    steps.forEach((s, n) => { s.hidden = n !== i; });
    progress.querySelectorAll('i').forEach((seg, n) => seg.classList.toggle('active', n <= i));
    stepLabel.textContent = `${i + 1} ${stepLabel.dataset.of} ${steps.length}`;
    back.hidden = i === 0;
    const last = i === steps.length - 1;
    next.textContent = last ? label(short ? 'finish-short' : 'finish') : label('continue');
    next.disabled = short && !steps[i].querySelector('input:checked, input[type=number]');
  };
  form.addEventListener('change', () => { next.disabled = false; });
  back.addEventListener('click', () => show(current - 1));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current < steps.length - 1) {
      show(current + 1);
      return;
    }
    if (short) {
      const url = new URL(config.handoff || '/', window.location.href);
      new URLSearchParams(new FormData(form)).forEach((v, k) => url.searchParams.set(k, v));
      window.location.assign(url);
      return;
    }
    next.disabled = true;
    const pick = (await recommend(answers(form))).toLowerCase();
    next.disabled = false;
    cards.querySelectorAll(':scope > li').forEach((li) => {
      const hit = li.dataset.name.toLowerCase() === pick;
      li.classList.toggle('recommended', hit);
      if (hit) cards.prepend(li);
    });
    heading.lastElementChild.textContent = cards.querySelector('.recommended')?.dataset.name || '';
    form.hidden = true;
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth' });
  });
  edit.addEventListener('click', () => {
    results.hidden = true;
    form.hidden = false;
    show(0);
  });
  show(0);
}
