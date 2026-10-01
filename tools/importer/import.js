// helix-importer-ui entry: `aem import`, then point the importer at tools/importer/import.js.
import transform from './transform.js';
import daPath from './paths.js';

export default {
  transform: ({ document, url, params }) => {
    const source = params?.originalURL || url;
    const { main, modals, fragments } = transform(document, { url: source });
    return [{ element: main, path: daPath(source) }, ...modals, ...fragments];
  },
};
