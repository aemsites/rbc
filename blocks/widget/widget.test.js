import { parseWidgetHref } from './widget.js';

describe('parseWidgetHref', () => {
  test('parses a path with one subdirectory', () => {
    expect(parseWidgetHref('/widgets/path1/name.html')).toEqual({
      widgetPath: 'path1',
      widgetName: 'name',
    });
  });

  test('parses a path with no subdirectory', () => {
    expect(parseWidgetHref('/widgets/name.html')).toEqual({
      widgetPath: '',
      widgetName: 'name',
    });
  });

  test('parses a nested path with multiple subdirectories', () => {
    expect(parseWidgetHref('/widgets/a/b/c.js')).toEqual({
      widgetPath: 'a/b',
      widgetName: 'c',
    });
  });

  test('strips the .html extension from widgetName', () => {
    const { widgetName } = parseWidgetHref('/widgets/my-widget.html');
    expect(widgetName).toBe('my-widget');
    expect(widgetName).not.toContain('.html');
  });

  test('strips any file extension from widgetName', () => {
    const { widgetName } = parseWidgetHref('/widgets/folder/widget.js');
    expect(widgetName).toBe('widget');
  });
});
