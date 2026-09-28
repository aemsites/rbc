import applyConfig from '../../scripts/config.js';

const TEMPLATE = `
<form class="savings-calculator-form">
  <div class="savings-calculator-intro">
    <h3 data-key="title">Estimate your savings over time</h3>
    <p data-key="intro">Answer the questions below to estimate how your savings could grow based on your contributions and time frame.</p>
  </div>
  <div class="savings-calculator-field">
    <label for="calc-start" data-key="start-label">How much can you contribute to start?</label>
    <small data-key="start-hint">Tell us how much you'd like to deposit to begin.</small>
    <div class="savings-calculator-input"><span>$</span><input type="number" id="calc-start" name="start" min="0" step="any" value="2000"></div>
  </div>
  <div class="savings-calculator-field">
    <label for="calc-freq" data-key="freq-label">How often will you contribute?</label>
    <small data-key="freq-hint">Choose how frequently you'll add to your savings.</small>
    <select id="calc-freq" name="freq">
      <option value="12" data-key="monthly">Monthly</option>
      <option value="52" data-key="weekly">Weekly</option>
      <option value="26" data-key="bi-weekly">Bi-weekly</option>
      <option value="1" data-key="yearly">Yearly</option>
    </select>
  </div>
  <div class="savings-calculator-field">
    <label for="calc-amount" data-key="amount-label">How much will you contribute each time?</label>
    <small data-key="amount-hint">Enter the amount you plan to deposit regularly.</small>
    <div class="savings-calculator-input"><span>$</span><input type="number" id="calc-amount" name="amount" min="0" step="any" value="200"></div>
  </div>
  <div class="savings-calculator-field">
    <label for="calc-years" data-key="years-label">How long do you plan to save for?</label>
    <small data-key="years-hint">Select the time frame that fits your savings goal.</small>
    <select id="calc-years" name="years">
      <option value="1" data-key="years-1">1 year</option>
      <option value="2" data-key="years-2">2 years</option>
      <option value="3" data-key="years-3">3 years</option>
      <option value="5" selected data-key="years-5">5 years</option>
      <option value="10" data-key="years-10">10 years</option>
      <option value="15" data-key="years-15">15 years</option>
      <option value="20" data-key="years-20">20 years</option>
    </select>
  </div>
  <div class="savings-calculator-field">
    <label for="calc-rate" data-key="rate-label">What is your expected savings interest rate?</label>
    <small data-key="rate-hint">Enter your desired interest rate.</small>
    <div class="savings-calculator-input"><input type="number" id="calc-rate" name="rate" min="0" step="any" value="1"><span>%</span></div>
  </div>
  <p><a data-key="rates-link" href="https://www.rbcroyalbank.com/rates/persacct.html">Learn more about savings interest rates</a></p>
</form>
<div class="savings-calculator-result">
  <div class="savings-calculator-headline"><p data-key="save-label">You could save</p><strong></strong><p class="savings-calculator-over"><span data-key="over-label">Over the next</span> <span></span> <span data-key="years-unit">years</span></p></div>
  <div class="savings-calculator-plot">
    <ol class="savings-calculator-axis"></ol>
    <ol class="savings-calculator-chart" data-label="Year"></ol>
  </div>
  <dl class="savings-calculator-totals">
    <div><dt data-key="deposits-label">Total deposits</dt><dd></dd></div>
    <div><dt data-key="interest-label">Total interest earned</dt><dd></dd></div>
    <div class="savings-calculator-total"><dt data-key="total-label">Total value</dt><dd></dd></div>
  </dl>
  <p class="savings-calculator-cta"><strong data-key="cta-label">Ready to Start Saving?</strong></p>
  <p class="button-wrapper"><a class="button primary" data-key="cta" href="/bank-accounts/savings-accounts">View All Savings Accounts</a></p>
</div>
`;

function project(start, amount, perYear, years, rate) {
  const daily = rate / 100 / 365;
  const totals = [];
  let balance = start;
  let deposits = start;
  let accrued = 0;
  for (let day = 1; day <= years * 365; day += 1) {
    accrued += balance * daily;
    if (day % 30 === 0) {
      balance += accrued;
      accrued = 0;
    }
    if (day % Math.round(365 / perYear) === 0) {
      balance += amount;
      deposits += amount;
    }
    if (day % 365 === 0) totals.push({ deposits, value: balance + accrued });
  }
  return totals;
}

// axis: a clean tick (1, 2, 2.5 or 5 × 10^n) giving five to eight gridlines up to the top value
function axisTicks(value) {
  const raw = (value || 1) / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const tick = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((t) => t >= raw);
  return { tick, max: Math.ceil((value || 1) / tick) * tick };
}

// rows: `key | value`; start, amount, years, rate, freq set defaults, other keys override labels
export default function decorate(block) {
  const config = applyConfig(block, TEMPLATE);
  const form = block.querySelector('form');
  const result = block.querySelector('.savings-calculator-result');
  const locale = document.documentElement.lang || 'en-CA';
  const money = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
  ['start', 'amount', 'years', 'rate', 'freq'].forEach((name) => {
    if (config[name]) form.elements[name].value = config[name];
  });

  const update = () => {
    const get = (name) => parseFloat(form.elements[name].value) || 0;
    const totals = project(get('start'), get('amount'), get('freq'), get('years'), get('rate'));
    const last = totals[totals.length - 1] || { deposits: 0, value: 0 };
    result.querySelector('.savings-calculator-headline strong').textContent = money(last.value);
    result.querySelector('.savings-calculator-over span:nth-child(2)').textContent = get('years');
    const [dep, int, tot] = result.querySelectorAll('dd');
    dep.textContent = money(last.deposits);
    int.textContent = money(last.value - last.deposits);
    tot.textContent = money(last.value);
    const { tick, max } = axisTicks(last.value);
    const axis = result.querySelector('.savings-calculator-axis');
    axis.parentElement.style.setProperty('--ticks', max / tick);
    axis.replaceChildren(...Array.from({ length: max / tick + 1 }, (_, i) => {
      const li = document.createElement('li');
      li.textContent = money(tick * i);
      return li;
    }));
    const chart = result.querySelector('.savings-calculator-chart');
    chart.replaceChildren(...totals.map(({ deposits, value }, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--deposits', `${(deposits / max) * 100}%`);
      li.style.setProperty('--value', `${(value / max) * 100}%`);
      li.dataset.label = `${chart.dataset.label} ${i + 1}`;
      li.title = money(value);
      return li;
    }));
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  update();
}
