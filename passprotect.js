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

    /**
     * Globals
     */
    var PASS_PROTECT_PASSWORD_CHECK_URI = "https://api.pwnedpasswords.com/range/";
    
    /**
     * Add listener to search for input fields
     * //TODO fails to pickup signin widget as inserted on load
     */
    window.addEventListener('load', protectInputs());

    function protectInputs() {
        var inputs = document.getElementsByTagName("input");
    
        for (var i = 0; i < inputs.length; i++) {
            switch (inputs[i].type) {
            case "email":
                break;
            case "password":
                inputs[i].addEventListener("change", protectPasswordInput);
                break;
            }
        }
        window.protected = true;
    }

    function protectPasswordInput(evt){
        var inputValue = evt.currentTarget.value;
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
                        var message = [
                            '<p>The password you just entered has been found in <b>' + numberFormatter(parseInt(data[1]))  + '</b> data breaches. <b>This password is not safe to use</b>.</p>',
                            '<p>This means attackers can easily find this password online and will often try to access accounts with it.</p>',
                            '<p>If you are currently using this password, please change it immediately to protect yourself. For more information, visit <a href="https://haveibeenpwned.com/" title="haveibeenpwned">Have I Been Pwned?</a>',
                            '<p>This notice will not show again for the duration of this session to give you time to update this password.</p>'
                        ].join('');
                        alert(message)
                    }
                }
            }
          };
        xmlHttp.send(null);
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