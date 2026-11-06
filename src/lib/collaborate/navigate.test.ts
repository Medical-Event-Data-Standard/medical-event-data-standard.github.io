/** @jest-environment jsdom */
import { expect, it } from '@jest/globals';

import { navigateTo } from './navigate';

it('points the current tab at the URL', () => {
  // jsdom only implements navigation within the page, which is enough to see where the tab was sent.
  navigateTo('#send-a-collaboration-request');
  expect(window.location.hash).toBe('#send-a-collaboration-request');
});
