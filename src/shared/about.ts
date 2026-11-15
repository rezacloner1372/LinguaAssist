/** Authorship and project links shown in the extension UI. */
export const AUTHOR_NAME = 'Mohammadreza Saberi';
export const AUTHOR_HANDLE = 'rezacloner1372';
export const AUTHOR_URL = `https://github.com/${AUTHOR_HANDLE}`;
export const REPO_URL = `https://github.com/${AUTHOR_HANDLE}/LinguaAssist`;
export const ISSUES_URL = `${REPO_URL}/issues`;

/** Version straight from the manifest, so it can never go stale in the UI. */
export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}
