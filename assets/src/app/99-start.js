/* ==========================================================================
   Start
   ========================================================================== */
APP.version = '3.5.0';
APP.ui = { naira, icon, note, pill, empty, toast, confirmBox, friendly };
function start() { shellInit(); paintBalance(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
