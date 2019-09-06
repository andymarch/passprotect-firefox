(function() {
    /**
     * Check and set a global guard variable.
     * If this content script is injected into the same page again,
     * it will do nothing next time.
     */
    if (window.hasRun) {
        return;
    }
    window.hasRun = true;

    /**
     * Detect to see whether or not this script has already been loaded or not. For
     * instance, if a developer includes passprotect-js in their site and a chrome
     * extension visitor stumbles across the same site, we don't want to double up
     * on notifications.
     */
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
        var chunks = scripts[i].src.split("/");

        if (chunks[chunks.length - 1] === "passprotect.min.js") {
            throw "passprotect already loaded, skipping";
        }
    }

    vex.defaultOptions.className = "vex-theme-wireframe";
    vex.defaultOptions.escapeButtonCloses = false;
    vex.defaultOptions.overlayClosesOnClick = false;
    vex.dialog.buttons.YES.text = browser.i18n.getMessage("confirmWarning");

    /**
     * Globals
     */
    var PASS_PROTECT_PASSWORD_CHECK_URI = "https://api.pwnedpasswords.com/range/";
    
    /**
     * Add listener to search for input fields on page load
     */
    window.addEventListener('load',function() {
        var inputs = document.getElementsByTagName("input");
        for (var i = 0; i < inputs.length; i++) {
            protectInput(inputs[i])
        }
    })

    /**
     * Add a mutation observer to catch any input fields injected after page load
     */
    var mutationObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                parseMutationNode(mutation.addedNodes[i])
            }
        });
    });
    mutationObserver.observe(document.documentElement, {
        attributes: false,
        characterData: false,
        childList: true,
        subtree: true,
        attributeOldValue: false,
        characterDataOldValue: false
    });

    function parseMutationNode(mutationNode){
        if(mutationNode.tagName == "INPUT"){
            protectInput(mutationNode)
        }
        if(mutationNode.childElementCount > 0){
            for (var i = 0; i < mutationNode.children.length; i++) {
                parseMutationNode(mutationNode.children[i])
            }
        }
    }

    function protectInput(input){
        switch (input.type) {
            case "password":
                input.addEventListener("change", protectPasswordInput);
                break;
        }
    }

    function protectPasswordInput(evt){
        var inputValue = evt.currentTarget.value;

        // If this email is cached, we shouldn't do anything.
        if (isIgnored(getEmailHash(inputValue))) {
            return;
        }

        var hash = sha1(inputValue).toUpperCase();
        var hashPrefix = hash.slice(0, 5);
        var shortHash = hash.slice(5);
        
        var xmlHttp = new XMLHttpRequest();
        // We're using the API with k-Anonymity searches to protect privacy.
        // You can read more about this here: https://haveibeenpwned.com/API/v2#SearchingPwnedPasswordsByRange
        xmlHttp.open("GET", PASS_PROTECT_PASSWORD_CHECK_URI + hashPrefix);
        xmlHttp.onload = function() {
            if (this.readyState == 4 && this.status == 200) {
                var resp = this.responseText.split("\n");

                for (var i = 0; i < resp.length; i++) {
                    var data = resp[i].split(":");
        
                    if (data[0].indexOf(shortHash) === 0) {
                        var message =[
                            browser.i18n.getMessage("breachCount",numberFormatter(parseInt(data[1]))),
                            browser.i18n.getMessage("breachExplainer"),
                            browser.i18n.getMessage("callToAction"),
                            browser.i18n.getMessage("sessionSuppressNotice")
                        ].join('');
                        
                        vex.dialog.alert({
                            message: browser.i18n.getMessage("warningTitle"),
                            input: message,
                            callback: function() {
                            // Cache this email once the user clicks the "I Understand" button
                            // so we don't continuously annoy the user with the
                            // same warnings.
                            localStorage.setItem(getEmailHash(inputValue), "true");
                            }
                        });
                    }
                }
            }
        };
        xmlHttp.send(null);
    }

    /**
     * Return a unique email hash suitable for caching.
     *
     * @param {string} email - The email address to hash.
     */
    function getEmailHash(email) {
        return sha1(email + "-" + getHost());
    }
    
    
    /**
     * Return the top level host name for a domain. EG: Given woot.adobe.com, will
     * return adobe.com.
     */
    function getHost() {
        return window.location.host.split('.').slice(-2).join('.');
    }

    /**
     * This function returns true if the data is ignored and should not be used to
     * fire off a notification, false otherwise.
     *
     * @param {string} sensitiveData - The sensitive data to check for in
     *      localStorage / sessionStorage.
     */
    function isIgnored(sensitiveData) {
        var data = sessionStorage.getItem(sensitiveData) || localStorage.getItem(sensitiveData);
    
        return data === "true" ? true : false;
    }
    

    /**
     * Format numbers in a nice, human-readable fashion =)
     *
     * Stolen from: https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
     */
    function numberFormatter(number, fractionDigits = 0, thousandSeperator = ',', fractionSeperator = '.') {
        if (number !==0 && !number || !Number.isFinite(number)) {
            return number;
        }
    
        const frDigits = Number.isFinite(fractionDigits)? Math.min(Math.max(fractionDigits, 0), 7) : 0;
        const num = number.toFixed(frDigits).toString();
    
        const parts = num.split('.');
        let digits = parts[0].split('').reverse();
        let sign = '';
    
        if (num < 0) {
            sign = digits.pop();
        }
    
        let final = [];
        let pos = 0;
    
        while (digits.length > 1) {
            final.push(digits.shift());
            pos++;
    
            if (pos % 3 === 0) {
                final.push(thousandSeperator);
            }
        }
    
        final.push(digits.shift());
        return `${sign}${final.reverse().join('')}${frDigits > 0 ? fractionSeperator : ''}${frDigits > 0 && parts[1] ? parts[1] : ''}`;
    }
})();