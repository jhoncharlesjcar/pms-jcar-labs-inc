/**
 * RawBT Integration Utility
 * Handles sending HTML payloads to the RawBT printing service
 * via Android Intent URL schemes.
 */

/**
 * Sends HTML content to the RawBT app.
 * @param {string} html - The HTML string to be printed.
 * @returns {boolean} - Returns true if the print request was dispatched successfully.
 */
export const printRawBT = (html) => {
  if (!html) {
    console.error('[Printer Module] Error: No HTML content provided to printRawBT.');
    return false;
  }

  try {
    // 1. URL encode the HTML
    const encodedHtml = encodeURIComponent(html);
    
    // 2. Unescape and convert to base64. 
    // btoa(unescape(encodeURIComponent(str))) properly encodes UTF-8 characters to Base64
    const base64Html = btoa(unescape(encodedHtml));
    
    // 3. Construct the RawBT intent URL
    // Format required by RawBT for parsing HTML payloads
    const intentUrl = `intent:data:text/html;base64,${base64Html}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;action=ru.a402d.rawbtprinter.PARSE;end;`;
    
    // 4. Trigger the intent
    // This will open the RawBT app if installed, or prompt to install if not,
    // although generally it just works seamlessly if the PWA is running on Android.
    window.location.href = intentUrl;
    
    return true;
  } catch (error) {
    console.error('[Printer Module] Error dispatching to RawBT:', error);
    return false;
  }
};
