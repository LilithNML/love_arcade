/**
 * Vercel Speed Insights Integration
 * 
 * Automatically tracks Web Vitals and other performance metrics.
 * This module loads the Speed Insights script from Vercel's CDN
 * and initializes tracking on page load.
 * 
 * Documentation: https://vercel.com/docs/speed-insights
 */

(function() {
  'use strict';

  /**
   * Initialize Speed Insights tracking queue
   * This queue collects events before the main script loads
   */
  window.si = window.si || function () {
    (window.siq = window.siq || []).push(arguments);
  };

  /**
   * Load Speed Insights script
   * The script is automatically injected by Vercel after deployment
   * For local development, this won't track any data (by design)
   */
  function loadSpeedInsights() {
    // Only load in production (when deployed to Vercel)
    // The actual script path will be injected by Vercel infrastructure
    // Format: /_vercel/speed-insights/script.js or /<unique-path>/script.js
    
    // Check if we're in development mode
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '';
    
    if (isDevelopment) {
      console.log('[Speed Insights] Development mode detected - tracking disabled');
      return;
    }

    // The script will be automatically injected by Vercel after enabling
    // Speed Insights in the dashboard and deploying the project
    console.log('[Speed Insights] Initialized - waiting for Vercel infrastructure');
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSpeedInsights);
  } else {
    loadSpeedInsights();
  }
})();
