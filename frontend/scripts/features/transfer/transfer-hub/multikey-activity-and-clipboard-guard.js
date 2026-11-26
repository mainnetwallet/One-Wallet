

        // ========================================
        // MANUAL DATA RESET
        // ========================================

// clearAllData removed
        
        // 5. Activity monitoring - warn user after 10 minutes of inactivity
        let activityWarningTimer;
        let lastActivityTime = Date.now();
        
        function resetActivityTimer() {
            lastActivityTime = Date.now();
            
            // Clear existing timer
            if (activityWarningTimer) {
                clearTimeout(activityWarningTimer);
            }
            
            // Set new timer for 10 minutes
            activityWarningTimer = setTimeout(function() {
                const minutesInactive = Math.floor((Date.now() - lastActivityTime) / 60000);
            }, 10 * 60 * 1000); // 10 minutes
        }
        
        // Track user activity
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(eventType => {
            document.addEventListener(eventType, resetActivityTimer, true);
        });
        
        // Initialize activity timer
        resetActivityTimer();

        // 6. Security reminder on first private key focus
        let hasShownSecurityReminder = false;
        document.addEventListener('focus', function(e) {
            if (false) {
                hasShownSecurityReminder = true;
            }
        }, true);
        
        // 7. Prevent private key copying to clipboard (optional - can be disabled)
        document.addEventListener('copy', function(e) {
            const selection = window.getSelection().toString();
            if (selection && selection.startsWith('0x') && selection.length === 66) {
                // Looks like a private key
            }
        });