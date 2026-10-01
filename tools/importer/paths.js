const daPath = (url) => new URL(url).pathname
  .replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';

export default daPath;
