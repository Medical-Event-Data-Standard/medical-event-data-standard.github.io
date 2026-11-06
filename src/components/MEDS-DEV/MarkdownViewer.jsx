// Moved to a shared component, as it renders a markdown file from any GitHub repository; this path is kept so
// existing imports keep working. It now takes `repo`, `version` and `markdownPath` instead of a raw URL, so that
// relative links and images in the file can be pointed at GitHub.
export { default } from '@site/src/components/common/GitHubMarkdown/GitHubMarkdownViewer';
