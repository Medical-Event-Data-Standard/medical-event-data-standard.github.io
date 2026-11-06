/**
 * Points the current tab at `url`. For a mailto: URL this opens the visitor's mail app and leaves the page
 * as it is. It lives in its own module so tests can replace it, because jsdom cannot navigate.
 */
export function navigateTo(url: string): void {
  window.location.href = url;
}
