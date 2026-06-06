chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_WEBSITE") {
    fetchWebsiteData(request.url)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will respond asynchronously
  }
});

async function fetchWebsiteData(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
        signal: controller.signal,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 GMB-Web-Checker'
        }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    return {
        html: html,
        finalUrl: response.url,
        redirected: response.redirected,
        status: response.status
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error fetching website:", error);
    return {
        html: null,
        error: error.name === 'AbortError' ? 'Timeout (5s)' : error.message,
        isBlocked: true
    };
  }
}
