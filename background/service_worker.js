chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_WEBSITE") {
    fetchWebsiteData(request.url)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will respond asynchronously
  }
});

async function fetchWebsiteData(url) {
  try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 GMB-Web-Checker'
        }
    });
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
    console.error("Error fetching website:", error);
    return {
        html: null,
        error: error.message,
        isBlocked: true
    };
  }
}
