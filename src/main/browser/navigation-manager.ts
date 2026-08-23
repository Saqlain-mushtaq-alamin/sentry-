export class NavigationManager {
  public static formatUrl(input: string, searchEngine: 'google' | 'duckduckgo' | 'bing' = 'google'): string {
    const trimmed = input.trim();
    if (!trimmed) return 'sentry://newtab';

    if (trimmed.startsWith('sentry://') || trimmed.startsWith('about:')) {
      return trimmed;
    }

    // Check if input looks like a valid URL
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=#]*)?$/i;
    const hasProtocol = /^[a-zA-Z]+:\/\//.test(trimmed);

    if (hasProtocol) {
      return trimmed;
    }

    if (urlPattern.test(trimmed) || trimmed.startsWith('localhost')) {
      return `https://${trimmed}`;
    }

    // Fallback to search query
    const encoded = encodeURIComponent(trimmed);
    switch (searchEngine) {
      case 'duckduckgo':
        return `https://duckduckgo.com/?q=${encoded}`;
      case 'bing':
        return `https://www.bing.com/search?q=${encoded}`;
      case 'google':
      default:
        return `https://www.google.com/search?q=${encoded}`;
    }
  }
}
