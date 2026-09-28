import fetchLocalPlaceholders from '../../utils/placeholders.js';

export default async function decorate(block) {
  const ph = await fetchLocalPlaceholders();
  const copy = block.firstElementChild;
  copy.className = 'branch-finder-copy';

  const form = document.createElement('form');
  form.className = 'branch-finder-form';
  form.method = 'post';
  form.action = 'https://maps.rbcroyalbank.com';
  form.innerHTML = `
    <fieldset>
      <legend>${ph.branchFinderLooking || 'What are you looking for?'}</legend>
      <label><input type="radio" name="location_type" value="BRANCH" checked> ${ph.branchFinderBranches || 'Branches'}</label>
      <label><input type="radio" name="location_type" value="ABM"> ${ph.branchFinderAtm || 'ATM'}</label>
    </fieldset>
    <label for="branch-finder-postal">${ph.branchFinderPostal || 'Postal Code:'}</label>
    <div class="branch-finder-field">
      <input id="branch-finder-postal" name="postal" type="text" autocomplete="postal-code" placeholder="${ph.branchFinderPlaceholder || 'Enter Postal Code'}">
      <button type="submit" class="button secondary">${ph.branchFinderSearch || 'Search'}</button>
    </div>
    <p><a href="https://maps.rbcroyalbank.com/index.php">${ph.branchFinderAdvanced || 'Advanced Search Options'}</a></p>
  `;
  block.append(form);
}
